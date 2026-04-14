import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    Linking,
    Platform,
    Pressable,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Webcam from 'react-webcam';
import LoadingOverlay from '../components/LoadingOverlay';
import WebcamCaptureStatusBanner from '../components/WebcamCaptureStatusBanner';
import { DEFAULT_RECIPE_MODE } from '../constants/recipeModes';
import { useAuth } from '../context/AuthContext';
import { useRecipeMode } from '../context/RecipeModeContext';
import { uploadWebcamImage } from '../services/cameraUploadApi';
import { detectIngredientsFromImage } from '../services/claudeApi';

const RECENT_SCAN_KEY = 'cooksmart:lastScan';
// const WEB_CAMERA_ASPECT_RATIO = 9 / 16;
const BACK_CAMERA_MAX_ZOOM = 0.58;
const FRONT_CAMERA_MAX_ZOOM = 0.3;
function clampValue(value, min, max) {
    return Math.min(max, Math.max(min, value));
}




function extractBase64FromDataUrl(dataUrl) {
    return String(dataUrl || '').split(',')[1] || '';
}

function getWebCameraErrorMessage(error) {
    if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        return 'Allow camera access in your browser to scan ingredients.';
    }

    if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
        return 'No camera was found on this device.';
    }

    if (error?.message === 'BROWSER_CAMERA_UNAVAILABLE') {
        return 'This browser does not expose a camera stream for the site.';
    }

    return 'Could not start the browser camera. Try refreshing the page or switching browsers.';
}

function inferMimeType(uri, fallback = 'image/jpeg') {
    const normalizedUri = String(uri || '').toLowerCase();

    if (normalizedUri.endsWith('.png')) {
        return 'image/png';
    }

    if (normalizedUri.endsWith('.webp')) {
        return 'image/webp';
    }

    if (normalizedUri.endsWith('.heic') || normalizedUri.endsWith('.heif')) {
        return 'image/heic';
    }

    return fallback;
}

export default function CameraScanScreen({ navigation, route }) {
    const isWeb = Platform.OS === 'web';
    const isFocused = useIsFocused();
    const { user } = useAuth();
    const { selectedMode } = useRecipeMode();
    const webcamRef = useRef(null);
    const webStreamRef = useRef(null);
    const webTrackRef = useRef(null);
    const webZoomCapabilityRef = useRef(null);
    const [nativeCameraPermission, setNativeCameraPermission] = useState(isWeb ? true : null);
    const [cameraFacing, setCameraFacing] = useState('back');
    const [zoom, setZoom] = useState(0);
    const [torchEnabled, setTorchEnabled] = useState(false);
    const [webCameraError, setWebCameraError] = useState(null);
    const [webTorchAvailable, setWebTorchAvailable] = useState(false);
    const [webTrackZoomSupported, setWebTrackZoomSupported] = useState(false);
    const [webCameraRefreshKey, setWebCameraRefreshKey] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [cameraReady, setCameraReady] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Preparing camera...');
    const [uploadError, setUploadError] = useState('');
    const [uploadedFile, setUploadedFile] = useState(null);
    const activeMode = route.params?.mode || selectedMode || DEFAULT_RECIPE_MODE;
    const maxZoom = getMaxZoom(cameraFacing);
    const cameraViewportStyle = {
        width: '100%',
        height: '100%',
    };
    const webPreviewScale = 1;
    const webPreviewTransform = [
        cameraFacing === 'front' ? 'scaleX(-1)' : '',
        webPreviewScale > 1.001 ? `scale(${webPreviewScale})` : '',
    ]
        .filter(Boolean)
        .join(' ');
    const webVideoConstraints = {
        facingMode: cameraFacing === 'back' ? 'environment' : 'user',
        width: { ideal: 1080 },
        height: { ideal: 1920 },
    };

    useEffect(() => {
        setCameraReady(false);
        setTorchEnabled(false);
        setZoom(0);
    }, [cameraFacing]);

    useEffect(() => {
        if (isWeb) {
            return;
        }

        let cancelled = false;

        ImagePicker.getCameraPermissionsAsync()
            .then((result) => {
                if (!cancelled) {
                    setNativeCameraPermission(Boolean(result.granted));
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setNativeCameraPermission(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [isWeb]);

    useEffect(() => {
        if (!isWeb || !isFocused) {
            setCameraReady(false);
            webStreamRef.current?.getTracks?.().forEach((track) => track.stop());
            webStreamRef.current = null;
            webTrackRef.current = null;
            webZoomCapabilityRef.current = null;
            return;
        };

        return () => {
            webStreamRef.current?.getTracks?.().forEach((track) => track.stop());
            webStreamRef.current = null;
            webTrackRef.current = null;
            webZoomCapabilityRef.current = null;
        };
    }, [isFocused, isWeb]);

    useEffect(() => {
        if (!isWeb || !isFocused || !webTrackRef.current) {
            return;
        }

        const videoTrack = webTrackRef.current;
        const advanced = {};
        const zoomCapability = webZoomCapabilityRef.current;

        if (zoomCapability) {
            advanced.zoom = clampValue(
                getZoomFactor(zoom, maxZoom),
                zoomCapability.min ?? 1,
                zoomCapability.max ?? getZoomFactor(zoom, maxZoom),
            );
        }

        if (cameraFacing === 'back' && webTorchAvailable) {
            advanced.torch = torchEnabled;
        }

        if (!Object.keys(advanced).length) {
            return;
        }

        videoTrack.applyConstraints({ advanced: [advanced] }).catch(() => { });
    }, [cameraFacing, isFocused, isWeb, maxZoom, torchEnabled, webTorchAvailable, zoom]);

    const saveRecentScan = useCallback(async (ingredients, photoUri) => {
        try {
            await AsyncStorage.setItem(
                RECENT_SCAN_KEY,
                JSON.stringify({
                    ingredients,
                    photoUri,
                    scannedAt: new Date().toISOString(),
                }),
            );
        } catch {
            // Storage is optional for this flow.
        }
    }, []);

    const navigateToResults = useCallback(
        async (ingredients, photoUri, options = {}) => {
            await saveRecentScan(ingredients, photoUri);
            const rootNavigation = navigation.getParent() ?? navigation;
            rootNavigation.navigate('IngredientsResult', {
                ingredients,
                photoUri,
                scannerError: options.scannerError || null,
                mode: activeMode,
            });
        },
        [activeMode, navigation, saveRecentScan],
    );

    const processImageAsset = useCallback(
        async ({ uri, base64, mimeType }) => {
            setIsProcessing(true);
            setUploadError('');
            setLoadingMessage('Uploading image...');

            try {
                try {
                    const uploadResult = await uploadWebcamImage({
                        uri,
                        mimeType: mimeType || inferMimeType(uri),
                        userId: user?.uid,
                        filePrefix: 'cooksmart-scan',
                    });
                    setUploadedFile(uploadResult?.file || null);
                } catch (uploadFailure) {
                    setUploadError(uploadFailure?.message || 'Could not upload the captured image.');
                }

                setLoadingMessage('Detecting ingredients...');
                const base64Image =
                    base64 ||
                    (await FileSystem.readAsStringAsync(uri, {
                        encoding: FileSystem.EncodingType.Base64,
                    }));

                const ingredients = await detectIngredientsFromImage(base64Image, {
                    mimeType: mimeType || inferMimeType(uri),
                });
                await navigateToResults(ingredients, uri);
            } catch (error) {
                let scannerError = 'Scanner unavailable. Add the ingredients manually below.';

                if (error?.code === 'MISSING_API_KEY') {
                    scannerError = 'Scanner API key is missing. Add Anthropic, Gemini, or OpenRouter credentials, restart Expo, or enter ingredients manually below.';
                } else if (error?.code === 'AUTH_ERROR') {
                    scannerError = 'The scanner API key was rejected. Check the provider key, or enter ingredients manually below.';
                } else if (error?.code === 'NETWORK_ERROR') {
                    scannerError = 'Could not contact the scanner provider from the device. Enter ingredients manually below.';
                } else if (error?.code === 'INVALID_RESPONSE') {
                    scannerError = 'The photo did not return usable ingredient data. Enter ingredients manually below.';
                } else if (error?.code === 'API_ERROR' && error?.status) {
                    scannerError =
                        error?.detail && error.detail.length < 180
                            ? error.detail
                            : `Ingredient scanner failed with status ${error.status}. Enter ingredients manually below.`;
                }

                await navigateToResults([], uri, { scannerError });
            } finally {
                setIsProcessing(false);
                setLoadingMessage('Preparing camera...');
            }
        },
        [navigateToResults, user?.uid],
    );

    const captureWebPhoto = useCallback(async () => {
        const dataUrl = webcamRef.current?.getScreenshot?.();

        if (!dataUrl) {
            throw new Error('Camera capture unavailable');
        }

        return {
            uri: dataUrl,
            base64: extractBase64FromDataUrl(dataUrl),
            mimeType: 'image/jpeg',
        };
    }, []);

    const handleWebUserMedia = useCallback((stream) => {
        const videoTrack = stream?.getVideoTracks?.()[0] || null;
        const zoomCapability = videoTrack?.getCapabilities?.().zoom;
        const torchCapability = videoTrack?.getCapabilities?.().torch;

        setWebCameraError(null);
        setCameraReady(true);
        webStreamRef.current = stream || null;
        webTrackRef.current = videoTrack;
        webZoomCapabilityRef.current =
            zoomCapability && typeof zoomCapability.max === 'number' ? zoomCapability : null;
        setWebTrackZoomSupported(Boolean(webZoomCapabilityRef.current));
        setWebTorchAvailable(
            Array.isArray(torchCapability) ? torchCapability.includes(true) : torchCapability === true,
        );
    }, []);

    const handleWebUserMediaError = useCallback((error) => {
        setCameraReady(false);
        setWebTorchAvailable(false);
        setWebTrackZoomSupported(false);
        webStreamRef.current = null;
        webTrackRef.current = null;
        webZoomCapabilityRef.current = null;
        setWebCameraError(getWebCameraErrorMessage(error));
    }, []);

    const requestNativeCameraPermission = useCallback(async () => {
        try {
            const result = await ImagePicker.requestCameraPermissionsAsync();
            const granted = Boolean(result.granted);
            setNativeCameraPermission(granted);
            return granted;
        } catch {
            setNativeCameraPermission(false);
            return false;
        }
    }, []);

    const handleCapture = useCallback(async () => {
        if (isProcessing || (isWeb && !cameraReady)) {
            return;
        }

        try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch {
            // Haptics are optional.
        }

        try {
            if (!isWeb && nativeCameraPermission !== true) {
                const granted = await requestNativeCameraPermission();
                if (!granted) {
                    Alert.alert(
                        'Camera permission needed',
                        'Allow camera access to scan ingredients with your phone camera.',
                    );
                    return;
                }
            }

            const photo = isWeb
                ? await captureWebPhoto()
                : await ImagePicker.launchCameraAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: false,
                    cameraType: cameraFacing,
                    base64: false,
                    exif: false,
                    quality: 0.85,
                });

            if (!isWeb && photo?.canceled) {
                return;
            }

            const asset = isWeb ? photo : photo?.assets?.[0];

            if (asset?.uri) {
                await processImageAsset({
                    uri: asset.uri,
                    base64: asset.base64,
                    mimeType: asset.mimeType || 'image/jpeg',
                });
            }
        } catch {
            Alert.alert('Camera error', 'Could not capture the photo. Please try again.');
        }
    }, [
        cameraFacing,
        cameraReady,
        captureWebPhoto,
        isProcessing,
        isWeb,
        nativeCameraPermission,
        processImageAsset,
        requestNativeCameraPermission,
    ]);

    const handlePickFromGallery = useCallback(async () => {
        if (isProcessing) {
            return;
        }

        try {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permissionResult.granted) {
                Alert.alert(
                    'Gallery permission needed',
                    'Allow photo library access to scan ingredients from your gallery.',
                );
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 1,
                base64: true,
                allowsEditing: false,
            });

            if (!result.canceled && result.assets?.[0]?.uri) {
                const asset = result.assets[0];
                await processImageAsset({
                    uri: asset.uri,
                    base64: asset.base64,
                    mimeType: asset.mimeType || inferMimeType(asset.uri),
                });
            }
        } catch {
            Alert.alert('Gallery error', 'Could not open the gallery. Please try again.');
        }
    }, [isProcessing, processImageAsset]);

    const handleBack = useCallback(() => {
        if (navigation.canGoBack()) {
            navigation.goBack();
            return;
        }

        navigation.navigate('MainTabs', { screen: 'Home' });
    }, [navigation]);

    const handleToggleTorch = useCallback(() => {
        if (!isWeb || cameraFacing === 'front') {
            return;
        }

        if (!webTorchAvailable) {
            Alert.alert('Torch unavailable', 'This browser or device does not support camera torch control.');
            return;
        }

        setTorchEnabled((current) => !current);
    }, [cameraFacing, isWeb, webTorchAvailable]);

    if (!isWeb && nativeCameraPermission === null) {
        return (
            <View className="flex-1 items-center justify-center bg-background px-6">
                <Text className="text-[22px] font-bold text-textPrimary">Preparing camera...</Text>
            </View>
        );
    }

    if (!isWeb && nativeCameraPermission === false) {
        return (
            <SafeAreaView className="flex-1 items-center justify-center bg-background px-6">
                <View className="w-full items-center rounded-3xl border border-white/10 bg-card p-6">
                    <Ionicons name="camera-outline" size={42} color="#00C896" />
                    <Text className="mt-4 text-center text-[22px] font-bold leading-[30px] text-textPrimary">
                        Camera access helps CookSmart spot your ingredients.
                    </Text>
                    <Text className="mb-[22px] mt-2.5 text-center text-[15px] leading-[22px] text-textSecondary">
                        Allow camera permission to snap your produce, pantry items, or leftovers.
                    </Text>
                    <Pressable
                        className="w-full items-center rounded-2xl bg-primary py-3.5"
                        onPress={requestNativeCameraPermission}
                    >
                        <Text className="text-[15px] font-bold text-background">Allow Camera</Text>
                    </Pressable>
                    <Pressable className="mt-3 py-2.5" onPress={() => Linking.openSettings()}>
                        <Text className="text-sm font-semibold text-textSecondary">Open Settings</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    if (isWeb && webCameraError && !cameraReady) {
        return (
            <SafeAreaView className="flex-1 items-center justify-center bg-background px-6">
                <View className="w-full items-center rounded-3xl border border-white/10 bg-card p-6">
                    <Ionicons name="camera-outline" size={42} color="#00C896" />
                    <Text className="mt-4 text-center text-[22px] font-bold leading-[30px] text-textPrimary">
                        Browser camera needs one quick fix.
                    </Text>
                    <Text className="mb-[22px] mt-2.5 text-center text-[15px] leading-[22px] text-textSecondary">
                        {webCameraError}
                    </Text>
                    <Pressable
                        className="w-full items-center rounded-2xl bg-primary py-3.5"
                        onPress={() => setWebCameraRefreshKey((current) => current + 1)}
                    >
                        <Text className="text-[15px] font-bold text-background">Try Camera Again</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <View style={styles.screen}>
            <StatusBar barStyle="light-content" />

            <View style={styles.cameraPreviewShell}>
                <View
                    className="scanner-camera-web"
                    style={[styles.cameraViewport, cameraViewportStyle]}
                >
                    {isWeb ? (
                        <Webcam
                            ref={webcamRef}
                            key={`${cameraFacing}-${webCameraRefreshKey}`}
                            audio={false}
                            mirrored={cameraFacing === 'front'}
                            screenshotFormat="image/jpeg"
                            screenshotQuality={0.92}
                            videoConstraints={webVideoConstraints}
                            onUserMedia={handleWebUserMedia}
                            onUserMediaError={handleWebUserMediaError}
                            style={{
                                position: 'absolute',
                                top: 0,
                                right: 0,
                                bottom: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                background: '#050A10',
                                transform: webPreviewTransform || undefined,
                                transformOrigin: 'center center',
                            }}
                        />
                    ) : (
                        <View style={styles.nativeCameraStage}>
                            <View style={styles.nativeCameraStageGlow} />
                            <View style={styles.nativeCameraStageCard}>
                                <Ionicons name="camera-outline" size={54} color="#F6B44F" />
                                <Text style={styles.nativeCameraStageTitle}>Use your phone camera</Text>
                                <Text style={styles.nativeCameraStageText}>
                                    CookSmart now opens the system camera so framing feels natural and less zoomed in.
                                </Text>
                                <Pressable
                                    style={[styles.nativeCameraLaunchButton, isProcessing && styles.shutterButtonDisabled]}
                                    onPress={handleCapture}
                                    disabled={isProcessing}
                                >
                                    <Text style={styles.nativeCameraLaunchButtonText}>Open Camera</Text>
                                </Pressable>
                            </View>
                        </View>
                    )}
                </View>
            </View>

            <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
                <View style={styles.contentShell}>
                    <View style={styles.topBar}>
                        <Pressable style={styles.iconButton} onPress={handleBack}>
                            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
                        </Pressable>

                        <Pressable style={styles.iconButton} onPress={handlePickFromGallery}>
                            <Ionicons name="images-outline" size={22} color="#FFFFFF" />
                        </Pressable>
                    </View>

                    <WebcamCaptureStatusBanner
                        loading={isProcessing}
                        loadingMessage={loadingMessage}
                        errorMessage={uploadError}
                        uploadedFile={uploadedFile}
                        onDismissError={() => setUploadError('')}
                    />

                    <View style={styles.bottomStack}>
                        {isWeb ? null : (
                            <View style={styles.zoomPresetRow}>
                                <View style={[styles.zoomPresetChip, styles.zoomPresetChipActive]}>
                                    <Text style={[styles.zoomPresetText, styles.zoomPresetTextActive]}>System Camera</Text>
                                </View>
                            </View>
                        )}

                        <View style={styles.controlDock}>
                            <Pressable
                                style={styles.sideControl}
                                onPress={() => setCameraFacing((current) => (current === 'back' ? 'front' : 'back'))}
                            >
                                <Ionicons name="camera-reverse-outline" size={24} color="#FFFFFF" />
                            </Pressable>

                            <Pressable
                                style={[styles.shutterButton, (isProcessing || (isWeb && !cameraReady)) && styles.shutterButtonDisabled]}
                                onPress={handleCapture}
                                disabled={isProcessing || (isWeb && !cameraReady)}
                            >
                                <View style={styles.shutterOuterRing}>
                                    <View style={styles.shutterInnerRing}>
                                        <View style={styles.shutterCore} />
                                    </View>
                                </View>
                            </Pressable>

                            <Pressable
                                style={[
                                    styles.sideControl,
                                    (!isWeb || cameraFacing === 'front' || !webTorchAvailable) && styles.controlDisabled,
                                ]}
                                onPress={handleToggleTorch}
                                disabled={!isWeb || cameraFacing === 'front' || !webTorchAvailable}
                            >
                                <Ionicons
                                    name={
                                        !isWeb || cameraFacing === 'front' || !webTorchAvailable
                                            ? 'flash-off-outline'
                                            : torchEnabled
                                                ? 'flash'
                                                : 'flash-outline'
                                    }
                                    size={22}
                                    color="#FFFFFF"
                                />
                            </Pressable>
                        </View>

                        <Text style={styles.bottomHelperText}>
                            {isWeb
                                ? 'Tap the shutter to scan ingredients.'
                                : 'Tap the shutter or Open Camera to scan with your phone camera.'}
                        </Text>
                    </View>
                </View>
            </SafeAreaView>

            <LoadingOverlay visible={isProcessing} message={loadingMessage} />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#050A10',
    },
    cameraPreviewShell: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#050A10',
    },
    cameraViewport: {
        flex: 1,
        width: '100%',
        overflow: 'hidden',
        backgroundColor: '#050A10',
    },
    nativeCameraStage: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    nativeCameraStageGlow: {
        position: 'absolute',
        width: 260,
        height: 260,
        borderRadius: 130,
        backgroundColor: 'rgba(246, 180, 79, 0.14)',
    },
    nativeCameraStageCard: {
        width: '100%',
        maxWidth: 360,
        alignItems: 'center',
        borderRadius: 30,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(7,16,24,0.78)',
        paddingHorizontal: 24,
        paddingVertical: 28,
    },
    nativeCameraStageTitle: {
        marginTop: 16,
        textAlign: 'center',
        fontSize: 24,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    nativeCameraStageText: {
        marginTop: 10,
        textAlign: 'center',
        fontSize: 15,
        lineHeight: 22,
        color: 'rgba(255,255,255,0.72)',
    },
    nativeCameraLaunchButton: {
        marginTop: 22,
        minWidth: 170,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 18,
        backgroundColor: '#F6B44F',
        paddingHorizontal: 18,
        paddingVertical: 14,
    },
    nativeCameraLaunchButtonText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#08131C',
    },
    cameraOverlay: {
        ...StyleSheet.absoluteFillObject,
    },
    overlayGlowTop: {
        position: 'absolute',
        top: -140,
        right: -70,
        width: 280,
        height: 280,
        borderRadius: 140,
        backgroundColor: 'rgba(246, 180, 79, 0.14)',
    },
    overlayGlowBottom: {
        position: 'absolute',
        bottom: 110,
        left: -110,
        width: 260,
        height: 260,
        borderRadius: 130,
        backgroundColor: 'rgba(128, 201, 150, 0.16)',
    },
    overlayShadeTop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 180,
        backgroundColor: 'rgba(4, 10, 16, 0.34)',
    },
    overlayShadeBottom: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 320,
        backgroundColor: 'rgba(4, 10, 16, 0.55)',
    },
    safeArea: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 12,
    },
    contentShell: {
        flex: 1,
        justifyContent: 'space-between',
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    iconButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: 'rgba(7,16,24,0.76)',
    },
    headerMetaStack: {
        alignItems: 'flex-end',
        gap: 10,
    },
    modeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    modeBadgeText: {
        marginLeft: 8,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.4,
    },
    miniBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(7,16,24,0.7)',
        paddingHorizontal: 12,
        paddingVertical: 7,
    },
    miniBadgeText: {
        marginLeft: 6,
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    stage: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
    },
    sideRail: {
        position: 'absolute',
        top: '20%',
        right: 0,
        alignItems: 'center',
        gap: 12,
    },
    railButton: {
        width: 56,
        height: 56,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(7,16,24,0.84)',
    },
    controlDisabled: {
        opacity: 0.45,
    },
    zoomRail: {
        width: 58,
        alignItems: 'center',
        borderRadius: 28,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(7,16,24,0.88)',
        paddingVertical: 12,
    },
    zoomIconButton: {
        width: 42,
        height: 42,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    zoomLabel: {
        marginTop: 2,
        fontSize: 14,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    zoomCaption: {
        marginTop: 4,
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.56)',
    },
    zoomReset: {
        width: 36,
        height: 36,
        marginTop: 10,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    scanFrame: {
        borderRadius: 34,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.18)',
        backgroundColor: 'rgba(5, 10, 16, 0.12)',
        overflow: 'hidden',
    },
    frameCorner: {
        position: 'absolute',
        width: 42,
        height: 42,
        borderColor: '#F6B44F',
    },
    frameCornerTopLeft: {
        top: 18,
        left: 18,
        borderTopWidth: 4,
        borderLeftWidth: 4,
        borderTopLeftRadius: 18,
    },
    frameCornerTopRight: {
        top: 18,
        right: 18,
        borderTopWidth: 4,
        borderRightWidth: 4,
        borderTopRightRadius: 18,
    },
    frameCornerBottomLeft: {
        bottom: 18,
        left: 18,
        borderBottomWidth: 4,
        borderLeftWidth: 4,
        borderBottomLeftRadius: 18,
    },
    frameCornerBottomRight: {
        bottom: 18,
        right: 18,
        borderBottomWidth: 4,
        borderRightWidth: 4,
        borderBottomRightRadius: 18,
    },
    frameGuideHorizontal: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: '50%',
        height: 1.5,
        backgroundColor: 'rgba(255,255,255,0.22)',
    },
    frameGuideVertical: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: '50%',
        width: 1.5,
        backgroundColor: 'rgba(255,255,255,0.14)',
    },
    frameFocusWindow: {
        position: 'absolute',
        left: '18%',
        right: '18%',
        top: '22%',
        bottom: '22%',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    focusHint: {
        flexDirection: 'row',
        alignItems: 'center',
        maxWidth: 330,
        marginTop: 18,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(7,16,24,0.78)',
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    focusHintText: {
        flex: 1,
        marginLeft: 8,
        fontSize: 12,
        lineHeight: 17,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.74)',
    },
    bottomStack: {
        paddingTop: 8,
    },
    zoomPresetRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
        marginBottom: 12,
    },
    zoomPresetChip: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(7,16,24,0.76)',
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    zoomPresetChipActive: {
        borderColor: 'rgba(246,180,79,0.4)',
        backgroundColor: 'rgba(246,180,79,0.18)',
    },
    zoomPresetText: {
        fontSize: 12,
        fontWeight: '800',
        color: 'rgba(255,255,255,0.7)',
    },
    zoomPresetTextActive: {
        color: '#F6B44F',
    },
    controlDock: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 30,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(7,16,24,0.9)',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    sideControl: {
        width: 58,
        height: 58,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    shutterButton: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    shutterButtonDisabled: {
        opacity: 0.65,
    },
    shutterOuterRing: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(246,180,79,0.7)',
        backgroundColor: 'rgba(246,180,79,0.08)',
    },
    shutterInnerRing: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 5,
        borderColor: '#FFFFFF',
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    shutterCore: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#F6B44F',
    },
    bottomHelperText: {
        marginTop: 10,
        textAlign: 'center',
        fontSize: 12,
        lineHeight: 17,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.58)',
    },
});
