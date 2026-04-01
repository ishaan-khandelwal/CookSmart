import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    Linking,
    Platform,
    Pressable,
    StatusBar,
    StyleSheet,
    Text,
    useWindowDimensions,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingOverlay from '../components/LoadingOverlay';
import { detectIngredientsFromImage } from '../services/claudeApi';

const RECENT_SCAN_KEY = 'cooksmart:lastScan';
const TARGET_CAMERA_RATIO = '4:3';

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

function FrameCorner({ style }) {
    return <View pointerEvents="none" style={[styles.frameCorner, style]} />;
}

export default function CameraScanScreen({ navigation }) {
    const cameraRef = useRef(null);
    const webVideoRef = useRef(null);
    const webStreamRef = useRef(null);
    const [permission, requestPermission] = useCameraPermissions();
    const [cameraFacing, setCameraFacing] = useState('back');
    const [isProcessing, setIsProcessing] = useState(false);
    const [recentIngredients, setRecentIngredients] = useState([]);
    const [lastPhotoUri, setLastPhotoUri] = useState(null);
    const [cameraReady, setCameraReady] = useState(false);
    const [webCameraError, setWebCameraError] = useState('');
    const [webReloadToken, setWebReloadToken] = useState(0);
    const { width, height } = useWindowDimensions();
    const isWeb = Platform.OS === 'web';
    const frameWidth = Math.min(width - 30, 360);
    const frameHeight = Math.min(Math.max(height * (isWeb ? 0.5 : 0.42), 280), isWeb ? 460 : 400);

    const stopWebCameraStream = useCallback(() => {
        const activeStream = webStreamRef.current;
        if (!activeStream?.getTracks) {
            webStreamRef.current = null;
            return;
        }

        activeStream.getTracks().forEach((track) => track.stop());
        webStreamRef.current = null;
    }, []);

    const loadRecentScan = useCallback(async () => {
        try {
            const savedScan = await AsyncStorage.getItem(RECENT_SCAN_KEY);
            if (!savedScan) {
                setRecentIngredients([]);
                return;
            }

            const parsedScan = JSON.parse(savedScan);
            setRecentIngredients(Array.isArray(parsedScan.ingredients) ? parsedScan.ingredients : []);
        } catch {
            setRecentIngredients([]);
        }
    }, []);

    useEffect(() => {
        loadRecentScan();
    }, [loadRecentScan]);

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', loadRecentScan);
        return unsubscribe;
    }, [loadRecentScan, navigation]);

    useEffect(() => {
        setCameraReady(false);
    }, [cameraFacing]);

    useEffect(() => {
        if (!isWeb || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
            return undefined;
        }

        let isActive = true;

        const startWebCamera = async () => {
            setCameraReady(false);
            setWebCameraError('');
            stopWebCameraStream();

            try {
                let stream;

                try {
                    stream = await navigator.mediaDevices.getUserMedia({
                        audio: false,
                        video: {
                            facingMode: cameraFacing === 'back' ? { ideal: 'environment' } : 'user',
                            width: { ideal: 1920 },
                            height: { ideal: 1080 },
                        },
                    });
                } catch {
                    stream = await navigator.mediaDevices.getUserMedia({
                        audio: false,
                        video: true,
                    });
                }

                if (!isActive) {
                    stream?.getTracks?.().forEach((track) => track.stop());
                    return;
                }

                webStreamRef.current = stream;

                const videoElement = webVideoRef.current;
                if (!videoElement) {
                    return;
                }

                videoElement.srcObject = stream;
                videoElement.onloadedmetadata = async () => {
                    try {
                        await videoElement.play();
                    } catch {
                        // Browsers may block autoplay until metadata is loaded.
                    }

                    if (isActive) {
                        setCameraReady(true);
                    }
                };
            } catch {
                if (isActive) {
                    setWebCameraError('Camera access is blocked in the browser. Allow camera permission and reload the scanner.');
                }
            }
        };

        startWebCamera();

        return () => {
            isActive = false;
            stopWebCameraStream();
        };
    }, [cameraFacing, isWeb, stopWebCameraStream, webReloadToken]);

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
            setRecentIngredients(ingredients);
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
            });
        },
        [navigation, saveRecentScan],
    );

    const processImageAsset = useCallback(
        async ({ uri, base64, mimeType }) => {
            setIsProcessing(true);
            setLastPhotoUri(uri);

            try {
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
            }
        },
        [navigateToResults],
    );

    const handleCapture = useCallback(async () => {
        if (isProcessing || !cameraReady) {
            return;
        }

        try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch {
            // Haptics are optional.
        }

        try {
            if (isWeb) {
                const videoElement = webVideoRef.current;
                const captureWidth = videoElement?.videoWidth;
                const captureHeight = videoElement?.videoHeight;

                if (!videoElement || !captureWidth || !captureHeight || typeof document === 'undefined') {
                    throw new Error('Web camera not ready');
                }

                const canvas = document.createElement('canvas');
                canvas.width = captureWidth;
                canvas.height = captureHeight;

                const context = canvas.getContext('2d');
                if (!context) {
                    throw new Error('Canvas unavailable');
                }

                if (cameraFacing === 'front') {
                    context.translate(captureWidth, 0);
                    context.scale(-1, 1);
                }

                context.drawImage(videoElement, 0, 0, captureWidth, captureHeight);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.96);

                await processImageAsset({
                    uri: dataUrl,
                    base64: dataUrl.split(',')[1] || '',
                    mimeType: 'image/jpeg',
                });

                return;
            }

            if (!cameraRef.current) {
                throw new Error('Camera not ready');
            }

            const photo = await cameraRef.current.takePictureAsync({
                quality: 1,
                base64: true,
                exif: true,
                skipProcessing: false,
            });

            if (photo?.uri) {
                await processImageAsset({
                    uri: photo.uri,
                    base64: photo.base64,
                    mimeType: 'image/jpeg',
                });
            }
        } catch {
            Alert.alert('Camera error', 'Could not capture the photo. Please try again.');
        }
    }, [cameraFacing, cameraReady, isProcessing, isWeb, processImageAsset]);

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

    const handleCameraReady = useCallback(() => {
        setCameraReady(true);
    }, []);

    if (!isWeb && !permission) {
        return (
            <View className="flex-1 items-center justify-center bg-background px-6">
                <Text className="text-[22px] font-bold text-textPrimary">Preparing camera...</Text>
            </View>
        );
    }

    if (isWeb && webCameraError) {
        return (
            <SafeAreaView className="flex-1 items-center justify-center bg-background px-6">
                <View className="w-full items-center rounded-3xl border border-white/10 bg-card p-6">
                    <Ionicons name="camera-outline" size={42} color="#00C896" />
                    <Text className="mt-4 text-center text-[20px] font-bold leading-[28px] text-textPrimary">
                        Browser camera permission needed.
                    </Text>
                    <Text className="mb-[22px] mt-2.5 text-center text-[15px] leading-[22px] text-textSecondary">
                        {webCameraError}
                    </Text>
                    <Pressable className="w-full items-center rounded-2xl bg-primary py-3.5" onPress={() => setWebReloadToken((value) => value + 1)}>
                        <Text className="text-[15px] font-bold text-background">Try Again</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    if (!isWeb && !permission.granted) {
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
                    <Pressable className="w-full items-center rounded-2xl bg-primary py-3.5" onPress={requestPermission}>
                        <Text className="text-[15px] font-bold text-background">Allow Camera</Text>
                    </Pressable>
                    <Pressable className="mt-3 py-2.5" onPress={() => Linking.openSettings()}>
                        <Text className="text-sm font-semibold text-textSecondary">Open Settings</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <View style={styles.screen}>
            <StatusBar barStyle="light-content" />
            <View style={StyleSheet.absoluteFillObject}>
                {isWeb
                    ? createElement('video', {
                        ref: webVideoRef,
                        autoPlay: true,
                        muted: true,
                        playsInline: true,
                        style: {
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            backgroundColor: '#050A10',
                            transform: cameraFacing === 'front' ? 'scaleX(-1)' : undefined,
                        },
                    })
                    : (
                        <CameraView
                            ref={cameraRef}
                            style={StyleSheet.absoluteFillObject}
                            facing={cameraFacing}
                            onCameraReady={handleCameraReady}
                            ratio={TARGET_CAMERA_RATIO}
                            mirror={cameraFacing === 'front'}
                            zoom={0}
                        />
                    )}
            </View>

            <View pointerEvents="none" style={styles.cameraOverlay}>
                <View style={styles.overlayGlowTop} />
                <View style={styles.overlayGlowBottom} />
                <View style={styles.overlayShadeTop} />
                <View style={styles.overlayShadeBottom} />
            </View>

            <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
                <View style={styles.contentShell}>
                    <View style={styles.headerRow}>
                        <Pressable style={styles.headerButton} onPress={handleBack}>
                            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
                        </Pressable>
                    </View>

                    <View style={styles.stage}>
                        <View style={[styles.scanFrame, { width: frameWidth, height: frameHeight }]}>
                            <FrameCorner style={styles.frameCornerTopLeft} />
                            <FrameCorner style={styles.frameCornerTopRight} />
                            <FrameCorner style={styles.frameCornerBottomLeft} />
                            <FrameCorner style={styles.frameCornerBottomRight} />
                        </View>
                    </View>

                    <View style={styles.bottomStack}>
                        <View style={styles.controlDock}>
                            <Pressable
                                style={styles.sideControl}
                                onPress={() => setCameraFacing((current) => (current === 'back' ? 'front' : 'back'))}
                            >
                                <Ionicons name="camera-reverse-outline" size={24} color="#FFFFFF" />
                            </Pressable>

                            <Pressable
                                style={[styles.shutterButton, (isProcessing || !cameraReady) && styles.shutterButtonDisabled]}
                                onPress={handleCapture}
                                disabled={isProcessing || !cameraReady}
                            >
                                <View style={styles.shutterOuterRing}>
                                    <View style={styles.shutterInnerRing}>
                                        <View style={styles.shutterCore} />
                                    </View>
                                </View>
                            </Pressable>

                            <Pressable
                                style={styles.sideControl}
                                onPress={handlePickFromGallery}
                            >
                                <Ionicons name="images-outline" size={24} color="#FFFFFF" />
                            </Pressable>
                        </View>
                    </View>
                </View>
            </SafeAreaView>

            <LoadingOverlay visible={isProcessing} message="Identifying ingredients..." />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#050A10',
    },
    cameraOverlay: {
        ...StyleSheet.absoluteFillObject,
    },
    overlayGlowTop: {
        position: 'absolute',
        top: -120,
        right: -80,
        width: 260,
        height: 260,
        borderRadius: 130,
        backgroundColor: 'rgba(246, 180, 79, 0.16)',
    },
    overlayGlowBottom: {
        position: 'absolute',
        bottom: 120,
        left: -90,
        width: 240,
        height: 240,
        borderRadius: 120,
        backgroundColor: 'rgba(34, 197, 94, 0.12)',
    },
    overlayShadeTop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 170,
        backgroundColor: 'rgba(4, 10, 16, 0.32)',
    },
    overlayShadeBottom: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 300,
        backgroundColor: 'rgba(4, 10, 16, 0.5)',
    },
    safeArea: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 6,
        paddingBottom: 12,
    },
    contentShell: {
        flex: 1,
        justifyContent: 'space-between',
    },
    headerBlock: {
        paddingTop: 4,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerButton: {
        width: 46,
        height: 46,
        borderRadius: 23,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: 'rgba(7,16,24,0.76)',
    },
    headerTextWrap: {
        flex: 1,
        paddingHorizontal: 14,
    },
    headerSpacer: {
        width: 46,
        height: 46,
    },
    headerTitle: {
        textAlign: 'center',
        fontSize: 28,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    headerTitleCompact: {
        fontSize: 24,
    },
    headerSubtitle: {
        marginTop: 6,
        textAlign: 'center',
        fontSize: 13,
        lineHeight: 19,
        color: 'rgba(255,255,255,0.7)',
    },
    headerSubtitleCompact: {
        fontSize: 12,
        lineHeight: 17,
    },
    stage: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
    },
    stageCompact: {
        paddingVertical: 14,
    },
    tipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 10,
        marginTop: 16,
    },
    tipPill: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: 'rgba(7,16,24,0.7)',
        paddingHorizontal: 14,
        paddingVertical: 9,
    },
    tipPillText: {
        marginLeft: 8,
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    scanFrame: {
        borderRadius: 32,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.18)',
        backgroundColor: 'rgba(5, 10, 16, 0.12)',
        overflow: 'hidden',
    },
    scanBadge: {
        position: 'absolute',
        top: 14,
        alignSelf: 'center',
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 7,
        backgroundColor: 'rgba(7,16,24,0.75)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    scanBadgeText: {
        fontSize: 11,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1.8,
        color: '#F6B44F',
    },
    frameCenterLine: {
        position: 'absolute',
        left: '16%',
        right: '16%',
        top: '50%',
        height: 2,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.14)',
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
    guidanceCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: 16,
        width: '100%',
        maxWidth: 340,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(7,16,24,0.74)',
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    guidanceCardCompact: {
        marginTop: 12,
        paddingHorizontal: 14,
        paddingVertical: 14,
    },
    guidanceIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(246,180,79,0.18)',
        backgroundColor: 'rgba(246,180,79,0.12)',
    },
    guidanceCopy: {
        flex: 1,
        marginLeft: 12,
    },
    guidanceTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    guidanceBody: {
        marginTop: 4,
        fontSize: 13,
        lineHeight: 20,
        color: 'rgba(255,255,255,0.72)',
    },
    guidanceBodyCompact: {
        lineHeight: 18,
    },
    bottomStack: {
        paddingTop: 8,
    },
    recentPanel: {
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(7,16,24,0.82)',
        paddingHorizontal: 16,
        paddingVertical: 16,
        marginBottom: 12,
    },
    recentPanelCompact: {
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    recentHeaderRow: {
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    recentLabel: {
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.55)',
    },
    recentCount: {
        fontSize: 12,
        fontWeight: '600',
        color: '#F6B44F',
    },
    recentContent: {
        paddingRight: 6,
    },
    recentChip: {
        marginRight: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(246,180,79,0.18)',
        backgroundColor: 'rgba(246,180,79,0.12)',
        paddingHorizontal: 14,
        paddingVertical: 9,
    },
    recentChipText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    tipStrip: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(7,16,24,0.78)',
        paddingHorizontal: 15,
        paddingVertical: 11,
        marginBottom: 12,
    },
    tipStripText: {
        marginLeft: 8,
        flex: 1,
        fontSize: 13,
        lineHeight: 18,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.72)',
    },
    controlDock: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 30,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(7,16,24,0.88)',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    controlDockCompact: {
        borderRadius: 28,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    sideControl: {
        width: 56,
        height: 56,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    sideControlCompact: {
        width: 50,
        height: 50,
        borderRadius: 18,
    },
    shutterButton: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    shutterButtonDisabled: {
        opacity: 0.65,
    },
    shutterOuterRing: {
        width: 96,
        height: 96,
        borderRadius: 48,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(246,180,79,0.7)',
        backgroundColor: 'rgba(246,180,79,0.08)',
    },
    shutterOuterRingCompact: {
        width: 88,
        height: 88,
        borderRadius: 44,
    },
    shutterInnerRing: {
        width: 78,
        height: 78,
        borderRadius: 39,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 5,
        borderColor: '#FFFFFF',
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    shutterInnerRingCompact: {
        width: 72,
        height: 72,
        borderRadius: 36,
    },
    shutterCore: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: '#F6B44F',
    },
    shutterCoreCompact: {
        width: 52,
        height: 52,
        borderRadius: 26,
    },
    helperRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 10,
        paddingHorizontal: 4,
    },
    helperText: {
        flex: 1,
        fontSize: 12,
        lineHeight: 18,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.58)',
    },
    helperTextCompact: {
        fontSize: 11,
        lineHeight: 16,
    },
    retryButton: {
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    retryButtonText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#F6B44F',
    },
});
