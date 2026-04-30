import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import LoadingOverlay from '../components/LoadingOverlay';
import WebcamCaptureStatusBanner from '../components/WebcamCaptureStatusBanner';
import { DEFAULT_RECIPE_MODE } from '../constants/recipeModes';
import { useAuth } from '../context/AuthContext';
import { useRecipeMode } from '../context/RecipeModeContext';
import { uploadWebcamImage } from '../services/cameraUploadApi';
import { detectIngredientsFromImage } from '../services/claudeApi';

const RECENT_SCAN_KEY = 'cooksmart:lastScan';

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
    const { user } = useAuth();
    const { selectedMode } = useRecipeMode();
    const [nativeCameraPermission, setNativeCameraPermission] = useState(isWeb ? false : null);
    const [cameraFacing, setCameraFacing] = useState('back');
    const [isProcessing, setIsProcessing] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('Preparing camera...');
    const [uploadError, setUploadError] = useState('');
    const [uploadedFile, setUploadedFile] = useState(null);
    const activeMode = route.params?.mode || selectedMode || DEFAULT_RECIPE_MODE;

    // Web webcam refs & state
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const [webCamReady, setWebCamReady] = useState(false);
    const [webCamError, setWebCamError] = useState('');
    const [webFacingFront, setWebFacingFront] = useState(false);

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

    // Start webcam stream (web only)
    const startWebcam = useCallback(async (useFront = false) => {
        setWebCamError('');
        setWebCamReady(false);
        try {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
                streamRef.current = null;
            }
            const constraints = {
                video: {
                    facingMode: useFront ? 'user' : { ideal: 'environment' },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
                audio: false,
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }
            setWebCamReady(true);
        } catch (err) {
            setWebCamError(
                err?.name === 'NotAllowedError'
                    ? 'Camera permission denied. Please allow camera access in your browser.'
                    : 'Could not start camera. Make sure no other app is using it.',
            );
        }
    }, []);

    // Stop webcam stream
    const stopWebcam = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }
        setWebCamReady(false);
    }, []);

    // Auto-start webcam on web
    useEffect(() => {
        if (!isWeb) return;
        startWebcam(webFacingFront);
        return () => stopWebcam();
    }, [isWeb, webFacingFront, startWebcam, stopWebcam]);

    // Capture frame from webcam
    const captureWebcam = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current || isProcessing) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const base64 = dataUrl.split(',')[1];
        await processImageAsset({ uri: dataUrl, base64, mimeType: 'image/jpeg' });
    }, [isProcessing, processImageAsset]);

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
            setLoadingMessage('Preparing image...');

            try {
                const normalizedMimeType = mimeType || inferMimeType(uri);
                const previewUri =
                    uri ||
                    (base64 ? `data:${normalizedMimeType};base64,${base64}` : '');
                const base64Image =
                    base64 ||
                    (uri
                        ? await FileSystem.readAsStringAsync(uri, {
                            encoding: FileSystem.EncodingType.Base64,
                        })
                        : '');

                if (!base64Image) {
                    throw Object.assign(new Error('Image data could not be read from picker result.'), {
                        code: 'INVALID_IMAGE_DATA',
                    });
                }

                setLoadingMessage('Scanning ingredients...');
                const ingredients = await detectIngredientsFromImage(base64Image, {
                    mimeType: normalizedMimeType,
                });

                if (uri && !String(uri).startsWith('data:')) {
                    uploadWebcamImage({
                        uri,
                        mimeType: normalizedMimeType,
                        userId: user?.uid,
                        filePrefix: 'cooksmart-scan',
                    })
                        .catch(() => { });
                }

                await navigateToResults(ingredients, previewUri || null);
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
        if (isProcessing || isWeb) {
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

            const photo = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                cameraType: cameraFacing === 'front' ? 'front' : 'back',
                base64: true,
                exif: false,
                quality: 0.85,
                zoom: 0,
                presentationStyle: 'fullScreen',
            });

            if (photo?.canceled) {
                return;
            }

            const asset = photo?.assets?.[0];

            if (asset?.uri || asset?.base64) {
                await processImageAsset({
                    uri: asset.uri,
                    base64: asset.base64,
                    mimeType: asset.mimeType || 'image/jpeg',
                });
            } else {
                Alert.alert('Camera error', 'No image was returned from the camera. Please try again.');
            }
        } catch {
            Alert.alert('Camera error', 'Could not capture the photo. Please try again.');
        }
    }, [
        cameraFacing,
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
                mediaTypes: ['images'],
                quality: 1,
                base64: true,
                allowsEditing: false,
            });

            if (!result.canceled && (result.assets?.[0]?.uri || result.assets?.[0]?.base64)) {
                const asset = result.assets[0];
                await processImageAsset({
                    uri: asset.uri,
                    base64: asset.base64,
                    mimeType: asset.mimeType || inferMimeType(asset.uri),
                });
            } else if (!result.canceled) {
                Alert.alert('Gallery error', 'No image was returned from gallery. Please pick another image.');
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

    if (isWeb) {
        return (
            <View style={styles.screen}>
                <StatusBar barStyle="light-content" />

                {/* Inject global styles for the video element */}
                {typeof document !== 'undefined' && (() => {
                    let s = document.getElementById('cooksmart-cam-style');
                    if (!s) {
                        s = document.createElement('style');
                        s.id = 'cooksmart-cam-style';
                        s.textContent = [
                            '#cooksmart-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000;}',
                            '#cooksmart-canvas{display:none;}',
                        ].join('');
                        document.head.appendChild(s);
                    }
                    return null;
                })()}

                {/* Live video background */}
                <View style={StyleSheet.absoluteFill}>
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    {typeof document !== 'undefined' && (
                        <>
                            <video
                                id="cooksmart-video"
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                            />
                            <canvas id="cooksmart-canvas" ref={canvasRef} />
                        </>
                    )}
                </View>

                {/* Dark overlay */}
                <View style={styles.overlayShadeTop} />
                <View style={styles.overlayShadeBottom} />

                <SafeAreaView style={[styles.safeArea, { position: 'absolute', inset: 0 }]} edges={['top', 'left', 'right', 'bottom']}>
                    <View style={styles.contentShell}>
                        {/* Top bar */}
                        <View style={styles.topBar}>
                            <Pressable style={styles.iconButton} onPress={() => { stopWebcam(); handleBack(); }}>
                                <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
                            </Pressable>
                            <Pressable style={styles.iconButton} onPress={handlePickFromGallery}>
                                <Ionicons name="images-outline" size={22} color="#FFFFFF" />
                            </Pressable>
                        </View>

                        {/* Middle — error or hint */}
                        <View style={styles.stage}>
                            {webCamError ? (
                                <View style={styles.nativeCameraStageCard}>
                                    <Ionicons name="camera-off-outline" size={44} color="#F6B44F" />
                                    <Text style={styles.nativeCameraStageTitle}>Camera unavailable</Text>
                                    <Text style={styles.nativeCameraStageText}>{webCamError}</Text>
                                    <Pressable style={styles.nativeCameraLaunchButton} onPress={() => startWebcam(webFacingFront)}>
                                        <Text style={styles.nativeCameraLaunchButtonText}>Retry Camera</Text>
                                    </Pressable>
                                    <Pressable style={[styles.nativeCameraLaunchButton, { marginTop: 10, backgroundColor: 'rgba(255,255,255,0.1)' }]} onPress={handlePickFromGallery}>
                                        <Text style={[styles.nativeCameraLaunchButtonText, { color: '#FFFFFF' }]}>Pick From Gallery</Text>
                                    </Pressable>
                                </View>
                            ) : !webCamReady ? (
                                <View style={styles.nativeCameraStageCard}>
                                    <Ionicons name="camera-outline" size={44} color="#00C896" />
                                    <Text style={styles.nativeCameraStageTitle}>Starting camera…</Text>
                                </View>
                            ) : null}
                        </View>

                        <WebcamCaptureStatusBanner
                            loading={isProcessing}
                            loadingMessage={loadingMessage}
                            errorMessage={uploadError}
                            uploadedFile={uploadedFile}
                            onDismissError={() => setUploadError('')}
                        />

                        {/* Bottom controls */}
                        <View style={styles.bottomStack}>
                            <View style={styles.controlDock}>
                                {/* Flip camera */}
                                <Pressable
                                    style={styles.sideControl}
                                    onPress={() => setWebFacingFront((f) => !f)}
                                >
                                    <Ionicons name="camera-reverse-outline" size={24} color="#FFFFFF" />
                                </Pressable>

                                {/* Shutter */}
                                <Pressable
                                    style={[styles.shutterButton, (!webCamReady || isProcessing) && styles.shutterButtonDisabled]}
                                    onPress={captureWebcam}
                                    disabled={!webCamReady || isProcessing}
                                >
                                    <View style={styles.shutterOuterRing}>
                                        <View style={styles.shutterInnerRing}>
                                            <View style={styles.shutterCore} />
                                        </View>
                                    </View>
                                </Pressable>

                                {/* Gallery */}
                                <Pressable style={styles.sideControl} onPress={handlePickFromGallery}>
                                    <Ionicons name="images-outline" size={22} color="#FFFFFF" />
                                </Pressable>
                            </View>

                            <Text style={styles.bottomHelperText}>
                                Tap the shutter to scan · tap 🔄 to flip camera
                            </Text>
                        </View>
                    </View>
                </SafeAreaView>

                <LoadingOverlay visible={isProcessing} message={loadingMessage} />
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            <StatusBar barStyle="light-content" />

            <View style={styles.cameraPreviewShell}>
                <View className="scanner-camera-web" style={styles.cameraViewport} />
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

                    <View style={styles.stage}>
                        <View style={styles.nativeCameraStageGlow} />
                        <View style={styles.nativeCameraStageCard}>
                            <Ionicons name="camera-outline" size={54} color="#F6B44F" />
                            <Text style={styles.nativeCameraStageTitle}>Use your phone camera</Text>
                            <Text style={styles.nativeCameraStageText}>
                                CookSmart opens the Expo mobile camera flow for scanning ingredients.
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

                    <WebcamCaptureStatusBanner
                        loading={isProcessing}
                        loadingMessage={loadingMessage}
                        errorMessage={uploadError}
                        uploadedFile={uploadedFile}
                        onDismissError={() => setUploadError('')}
                    />

                    <View style={styles.bottomStack}>
                        <View style={styles.controlDock}>
                            <Pressable
                                style={styles.sideControl}
                                onPress={() => setCameraFacing((current) => (current === 'back' ? 'front' : 'back'))}
                            >
                                <Ionicons name="camera-reverse-outline" size={24} color="#FFFFFF" />
                            </Pressable>

                            <Pressable
                                style={[styles.shutterButton, isProcessing && styles.shutterButtonDisabled]}
                                onPress={handleCapture}
                                disabled={isProcessing}
                            >
                                <View style={styles.shutterOuterRing}>
                                    <View style={styles.shutterInnerRing}>
                                        <View style={styles.shutterCore} />
                                    </View>
                                </View>
                            </Pressable>

                            <Pressable
                                style={[styles.sideControl, styles.controlDisabled]}
                                disabled
                            >
                                <Ionicons
                                    name="flash-off-outline"
                                    size={22}
                                    color="#FFFFFF"
                                />
                            </Pressable>
                        </View>

                        <Text style={styles.bottomHelperText}>
                            Tap the shutter or Open Camera to scan with your phone camera in Expo.
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
