import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
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
    useWindowDimensions,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingOverlay from '../components/LoadingOverlay';
import { DEFAULT_RECIPE_MODE, getRecipeModeMeta } from '../constants/recipeModes';
import { useRecipeMode } from '../context/RecipeModeContext';
import { detectIngredientsFromImage } from '../services/claudeApi';

const RECENT_SCAN_KEY = 'cooksmart:lastScan';
const TARGET_CAMERA_RATIO = '16:9';
const BACK_CAMERA_MAX_ZOOM = 0.58;
const FRONT_CAMERA_MAX_ZOOM = 0.3;
const ZOOM_STEP = 0.075;
const PINCH_ZOOM_SENSITIVITY = 0.0035;
const WEB_CAPTURE_RESOLUTIONS = [
    { width: 3840, height: 2160 },
    { width: 2560, height: 1440 },
    { width: 1920, height: 1080 },
];

function clampValue(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function getMaxZoom(facing) {
    return facing === 'front' ? FRONT_CAMERA_MAX_ZOOM : BACK_CAMERA_MAX_ZOOM;
}

function getZoomFactor(zoom, maxZoom) {
    if (!maxZoom) {
        return 1;
    }

    return 1 + (zoom / maxZoom) * 1.4;
}

function getZoomLabel(zoom, maxZoom) {
    return `${getZoomFactor(zoom, maxZoom).toFixed(1)}x`;
}

function getTouchDistance(touches = []) {
    if (touches.length < 2) {
        return 0;
    }

    const [firstTouch, secondTouch] = touches;
    const deltaX = firstTouch.pageX - secondTouch.pageX;
    const deltaY = firstTouch.pageY - secondTouch.pageY;
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
}

function parsePictureSize(size) {
    const match = String(size).match(/^(\d+)x(\d+)$/);

    if (!match) {
        return null;
    }

    const width = Number(match[1]);
    const height = Number(match[2]);

    if (!width || !height) {
        return null;
    }

    return {
        size,
        width,
        height,
        ratio: width / height,
        area: width * height,
    };
}

function pickBestPictureSize(sizes) {
    const preferredRatio = 16 / 9;
    const parsedSizes = sizes
        .map(parsePictureSize)
        .filter(Boolean)
        .sort((left, right) => {
            const ratioGap = Math.abs(left.ratio - preferredRatio) - Math.abs(right.ratio - preferredRatio);

            if (Math.abs(ratioGap) > 0.01) {
                return ratioGap;
            }

            return right.area - left.area;
        });

    return parsedSizes[0]?.size || null;
}

function stopMediaStream(stream) {
    stream?.getTracks?.().forEach((track) => {
        track.stop();
    });
}

function getWebPictureSizeLabel(videoTrack) {
    const settings = videoTrack?.getSettings?.();

    if (!settings?.width || !settings?.height) {
        return null;
    }

    return `${settings.width}x${settings.height}`;
}

function extractBase64FromDataUrl(dataUrl) {
    return String(dataUrl || '').split(',')[1] || '';
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        if (typeof FileReader === 'undefined') {
            reject(new Error('FileReader unavailable'));
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('Failed to read blob'));
        reader.readAsDataURL(blob);
    });
}

function getWindowImageCapture() {
    if (typeof window === 'undefined' || typeof window.ImageCapture !== 'function') {
        return null;
    }

    return window.ImageCapture;
}

function getCapabilityValue(capability, preferredKey = 'max') {
    if (typeof capability === 'number' && Number.isFinite(capability)) {
        return capability;
    }

    if (!capability || typeof capability !== 'object') {
        return null;
    }

    if (Number.isFinite(capability[preferredKey])) {
        return capability[preferredKey];
    }

    if (Number.isFinite(capability.max)) {
        return capability.max;
    }

    if (Number.isFinite(capability.min)) {
        return capability.min;
    }

    return null;
}

function getAspectRatioConstraint(aspectRatioCapability) {
    if (typeof aspectRatioCapability === 'number' && Number.isFinite(aspectRatioCapability)) {
        return Math.abs(aspectRatioCapability - (16 / 9)) < 0.2 ? { ideal: 16 / 9 } : null;
    }

    if (!aspectRatioCapability || typeof aspectRatioCapability !== 'object') {
        return null;
    }

    const min = Number.isFinite(aspectRatioCapability.min) ? aspectRatioCapability.min : null;
    const max = Number.isFinite(aspectRatioCapability.max) ? aspectRatioCapability.max : null;

    if (min !== null && max !== null && min <= 16 / 9 && max >= 16 / 9) {
        return { ideal: 16 / 9 };
    }

    return null;
}

async function optimizeWebTrackForQuality(videoTrack) {
    const capabilities = videoTrack?.getCapabilities?.();

    if (!capabilities) {
        return;
    }

    const nextConstraints = {};
    const maxWidth = getCapabilityValue(capabilities.width);
    const maxHeight = getCapabilityValue(capabilities.height);
    const aspectRatio = getAspectRatioConstraint(capabilities.aspectRatio);

    if (maxWidth) {
        nextConstraints.width = { ideal: Math.round(maxWidth) };
    }

    if (maxHeight) {
        nextConstraints.height = { ideal: Math.round(maxHeight) };
    }

    if (aspectRatio) {
        nextConstraints.aspectRatio = aspectRatio;
    }

    if (!Object.keys(nextConstraints).length) {
        return;
    }

    await videoTrack.applyConstraints(nextConstraints).catch(() => {});
}

async function getWebPhotoConfiguration(videoTrack) {
    const ImageCaptureConstructor = getWindowImageCapture();

    if (!videoTrack || !ImageCaptureConstructor) {
        return null;
    }

    try {
        const imageCapture = new ImageCaptureConstructor(videoTrack);
        const photoCapabilities = await imageCapture.getPhotoCapabilities?.();

        if (!photoCapabilities) {
            return null;
        }

        const imageWidth = getCapabilityValue(photoCapabilities.imageWidth);
        const imageHeight = getCapabilityValue(photoCapabilities.imageHeight);

        if (!imageWidth || !imageHeight) {
            return null;
        }

        return {
            settings: {
                imageWidth: Math.round(imageWidth),
                imageHeight: Math.round(imageHeight),
            },
            label: `${Math.round(imageWidth)}x${Math.round(imageHeight)}`,
        };
    } catch {
        return null;
    }
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

function buildWebConstraints(facing, resolution) {
    const facingMode = facing === 'back' ? 'environment' : 'user';

    if (!resolution) {
        return {
            audio: false,
            video: {
                facingMode: { ideal: facingMode },
            },
        };
    }

    return {
        audio: false,
        video: {
            facingMode: { ideal: facingMode },
            width: { ideal: resolution.width },
            height: { ideal: resolution.height },
            aspectRatio: { ideal: 16 / 9 },
        },
    };
}

async function requestWebCameraStream(facing) {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('BROWSER_CAMERA_UNAVAILABLE');
    }

    const attempts = [
        ...WEB_CAPTURE_RESOLUTIONS.map((resolution) => buildWebConstraints(facing, resolution)),
        buildWebConstraints(facing, null),
        {
            audio: false,
            video: {
                facingMode: facing === 'back' ? { ideal: 'environment' } : { ideal: 'user' },
            },
        },
        { audio: false, video: true },
    ];

    let lastError = null;

    for (const constraints of attempts) {
        try {
            return await navigator.mediaDevices.getUserMedia(constraints);
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('Unable to open the browser camera');
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

function FrameCorner({ style }) {
    return <View pointerEvents="none" style={[styles.frameCorner, style]} />;
}

export default function CameraScanScreen({ navigation, route }) {
    const isWeb = Platform.OS === 'web';
    const { selectedMode } = useRecipeMode();
    const cameraRef = useRef(null);
    const pinchZoomRef = useRef({ startDistance: 0, startZoom: 0 });
    const webVideoRef = useRef(null);
    const webStreamRef = useRef(null);
    const webTrackRef = useRef(null);
    const webZoomCapabilityRef = useRef(null);
    const webPhotoSettingsRef = useRef(null);
    const [permission, requestPermission] = useCameraPermissions();
    const [cameraFacing, setCameraFacing] = useState('back');
    const [zoom, setZoom] = useState(0);
    const [pictureSize, setPictureSize] = useState(null);
    const [torchEnabled, setTorchEnabled] = useState(false);
    const [webCameraError, setWebCameraError] = useState(null);
    const [webTorchAvailable, setWebTorchAvailable] = useState(false);
    const [webTrackZoomSupported, setWebTrackZoomSupported] = useState(false);
    const [webCameraRefreshKey, setWebCameraRefreshKey] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [recentIngredients, setRecentIngredients] = useState([]);
    const [cameraReady, setCameraReady] = useState(false);
    const { width, height } = useWindowDimensions();
    const activeMode = route.params?.mode || selectedMode || DEFAULT_RECIPE_MODE;
    const activeModeMeta = getRecipeModeMeta(activeMode);
    const maxZoom = getMaxZoom(cameraFacing);
    const zoomLabel = getZoomLabel(zoom, maxZoom);
    const frameWidth = Math.min(width - 34, 360);
    const frameHeight = Math.min(Math.max(height * 0.41, 280), 410);
    const fullWidthPreviewHeight = width * (16 / 9);
    const cameraViewportStyle = fullWidthPreviewHeight <= height
        ? { width, height: fullWidthPreviewHeight }
        : { width: height * (9 / 16), height };
    const zoomPresets = [
        { label: '1x', value: 0 },
        { label: '1.5x', value: maxZoom * 0.32 },
        { label: '2x', value: maxZoom * 0.68 },
    ];
    const webPreviewScale = isWeb && !webTrackZoomSupported ? getZoomFactor(zoom, maxZoom) : 1;
    const webPreviewTransform = [
        cameraFacing === 'front' ? 'scaleX(-1)' : '',
        webPreviewScale > 1.001 ? `scale(${webPreviewScale})` : '',
    ]
        .filter(Boolean)
        .join(' ');

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
        setPictureSize(null);
        setTorchEnabled(false);
        setZoom(0);
        pinchZoomRef.current = { startDistance: 0, startZoom: 0 };
    }, [cameraFacing]);

    useEffect(() => {
        if (!isWeb) {
            return undefined;
        }

        let cancelled = false;

        const startWebCamera = async () => {
            setWebCameraError(null);
            setWebTorchAvailable(false);
            setWebTrackZoomSupported(false);
            webZoomCapabilityRef.current = null;
            webPhotoSettingsRef.current = null;
            webTrackRef.current = null;

            stopMediaStream(webStreamRef.current);
            webStreamRef.current = null;

            try {
                const stream = await requestWebCameraStream(cameraFacing);

                if (cancelled) {
                    stopMediaStream(stream);
                    return;
                }

                const videoTrack = stream.getVideoTracks?.()[0] || null;
                const videoElement = webVideoRef.current;
                const zoomCapability = videoTrack?.getCapabilities?.().zoom;
                const torchCapability = videoTrack?.getCapabilities?.().torch;

                webStreamRef.current = stream;
                webTrackRef.current = videoTrack;

                await optimizeWebTrackForQuality(videoTrack);

                webZoomCapabilityRef.current =
                    zoomCapability && typeof zoomCapability.max === 'number' ? zoomCapability : null;
                setWebTrackZoomSupported(Boolean(webZoomCapabilityRef.current));
                setWebTorchAvailable(
                    Array.isArray(torchCapability) ? torchCapability.includes(true) : torchCapability === true,
                );

                const webPhotoConfiguration = await getWebPhotoConfiguration(videoTrack);
                if (webPhotoConfiguration?.settings) {
                    webPhotoSettingsRef.current = webPhotoConfiguration.settings;
                }

                const nextPictureSize = webPhotoConfiguration?.label || getWebPictureSizeLabel(videoTrack);
                if (nextPictureSize) {
                    setPictureSize(nextPictureSize);
                }

                if (videoElement) {
                    videoElement.srcObject = stream;
                    videoElement.onloadedmetadata = () => {
                        if (!cancelled) {
                            setCameraReady(true);
                        }
                    };

                    await videoElement.play().catch(() => {});

                    if (videoElement.readyState >= 1 && !cancelled) {
                        setCameraReady(true);
                    }
                }
            } catch (error) {
                if (!cancelled) {
                    setWebCameraError(getWebCameraErrorMessage(error));
                }
            }
        };

        startWebCamera();

        return () => {
            cancelled = true;

            const videoElement = webVideoRef.current;
            if (videoElement) {
                videoElement.pause?.();
                videoElement.srcObject = null;
                videoElement.onloadedmetadata = null;
            }

            stopMediaStream(webStreamRef.current);
            webStreamRef.current = null;
            webTrackRef.current = null;
            webZoomCapabilityRef.current = null;
            webPhotoSettingsRef.current = null;
        };
    }, [cameraFacing, isWeb, webCameraRefreshKey]);

    useEffect(() => {
        if (!isWeb || !webTrackRef.current) {
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

        videoTrack.applyConstraints({ advanced: [advanced] }).catch(() => {});
    }, [cameraFacing, isWeb, maxZoom, torchEnabled, webTorchAvailable, zoom]);

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
                mode: activeMode,
            });
        },
        [activeMode, navigation, saveRecentScan],
    );

    const processImageAsset = useCallback(
        async ({ uri, base64, mimeType }) => {
            setIsProcessing(true);

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

    const captureWebPhoto = useCallback(async () => {
        const videoElement = webVideoRef.current;
        const videoTrack = webTrackRef.current;

        if (videoTrack) {
            const ImageCaptureConstructor = getWindowImageCapture();

            if (ImageCaptureConstructor) {
                try {
                    const imageCapture = new ImageCaptureConstructor(videoTrack);
                    const blob = await imageCapture.takePhoto(webPhotoSettingsRef.current || undefined);

                    if (blob?.size) {
                        const dataUrl = await blobToDataUrl(blob);

                        return {
                            uri: dataUrl,
                            base64: extractBase64FromDataUrl(dataUrl),
                            mimeType: blob.type || 'image/jpeg',
                        };
                    }
                } catch {
                    // Fall back to the preview frame capture below.
                }
            }
        }

        if (!videoElement?.videoWidth || !videoElement?.videoHeight || typeof document === 'undefined') {
            throw new Error('Camera not ready');
        }

        const canvas = document.createElement('canvas');
        const outputWidth = videoElement.videoWidth;
        const outputHeight = videoElement.videoHeight;
        const cropZoom = webTrackZoomSupported ? 1 : getZoomFactor(zoom, maxZoom);
        const sourceWidth = outputWidth / cropZoom;
        const sourceHeight = outputHeight / cropZoom;
        const sourceX = (outputWidth - sourceWidth) / 2;
        const sourceY = (outputHeight - sourceHeight) / 2;
        const context = canvas.getContext('2d', { alpha: false });

        if (!context) {
            throw new Error('Camera capture unavailable');
        }

        canvas.width = outputWidth;
        canvas.height = outputHeight;
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';

        if (cameraFacing === 'front') {
            context.translate(outputWidth, 0);
            context.scale(-1, 1);
        }

        context.drawImage(
            videoElement,
            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight,
            0,
            0,
            outputWidth,
            outputHeight,
        );

        const dataUrl = canvas.toDataURL('image/jpeg', 1);

        return {
            uri: dataUrl,
            base64: extractBase64FromDataUrl(dataUrl),
            mimeType: 'image/jpeg',
        };
    }, [cameraFacing, maxZoom, webTrackZoomSupported, zoom]);

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
            const photo = isWeb
                ? captureWebPhoto()
                : await cameraRef.current?.takePictureAsync({
                    quality: 1,
                    base64: true,
                    exif: true,
                    skipProcessing: false,
                    shutterSound: false,
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
    }, [cameraReady, captureWebPhoto, isProcessing, isWeb, processImageAsset]);

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

    const handleCameraReady = useCallback(async () => {
        setCameraReady(true);

        if (isWeb) {
            return;
        }

        try {
            const sizes = await cameraRef.current?.getAvailablePictureSizesAsync?.();
            const nextPictureSize = pickBestPictureSize(Array.isArray(sizes) ? sizes : []);

            if (nextPictureSize) {
                setPictureSize(nextPictureSize);
            }
        } catch {
            // Not all devices expose picture sizes cleanly.
        }
    }, []);

    const handleZoomStep = useCallback(
        (direction) => {
            setZoom((currentZoom) => clampValue(currentZoom + direction, 0, maxZoom));
        },
        [maxZoom],
    );

    const handlePreviewResponderGrant = useCallback(
        (event) => {
            const distance = getTouchDistance(event.nativeEvent.touches);

            if (!distance) {
                return;
            }

            pinchZoomRef.current = {
                startDistance: distance,
                startZoom: zoom,
            };
        },
        [zoom],
    );

    const handlePreviewResponderMove = useCallback(
        (event) => {
            const distance = getTouchDistance(event.nativeEvent.touches);

            if (!distance) {
                return;
            }

            if (!pinchZoomRef.current.startDistance) {
                pinchZoomRef.current = {
                    startDistance: distance,
                    startZoom: zoom,
                };
                return;
            }

            const zoomDelta = (distance - pinchZoomRef.current.startDistance) * PINCH_ZOOM_SENSITIVITY;
            const nextZoom = clampValue(pinchZoomRef.current.startZoom + zoomDelta, 0, maxZoom);
            setZoom(nextZoom);
        },
        [maxZoom, zoom],
    );

    const handlePreviewResponderEnd = useCallback(() => {
        pinchZoomRef.current = {
            startDistance: 0,
            startZoom: zoom,
        };
    }, [zoom]);

    if (!isWeb && !permission) {
        return (
            <View className="flex-1 items-center justify-center bg-background px-6">
                <Text className="text-[22px] font-bold text-textPrimary">Preparing camera...</Text>
            </View>
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
                    onStartShouldSetResponder={(event) => event.nativeEvent.touches.length > 1}
                    onMoveShouldSetResponder={(event) => event.nativeEvent.touches.length > 1}
                    onResponderGrant={handlePreviewResponderGrant}
                    onResponderMove={handlePreviewResponderMove}
                    onResponderRelease={handlePreviewResponderEnd}
                    onResponderTerminate={handlePreviewResponderEnd}
                >
                    {isWeb ? (
                        <video
                            ref={webVideoRef}
                            autoPlay
                            muted
                            playsInline
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
                        <CameraView
                            ref={cameraRef}
                            style={StyleSheet.absoluteFillObject}
                            facing={cameraFacing}
                            onCameraReady={handleCameraReady}
                            ratio={TARGET_CAMERA_RATIO}
                            pictureSize={pictureSize || undefined}
                            mirror={cameraFacing === 'front'}
                            animateShutter={false}
                            enableTorch={cameraFacing === 'back' && torchEnabled}
                            zoom={zoom}
                        />
                    )}
                </View>
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

                        <View style={styles.headerMetaStack}>
                            <View
                                style={[
                                    styles.modeBadge,
                                    {
                                        borderColor: `${activeModeMeta.accent}55`,
                                        backgroundColor: `${activeModeMeta.accent}1F`,
                                    },
                                ]}
                            >
                                <Ionicons name={activeModeMeta.icon} size={14} color={activeModeMeta.accent} />
                                <Text style={[styles.modeBadgeText, { color: activeModeMeta.accent }]}>
                                    {activeModeMeta.shortTitle}
                                </Text>
                            </View>

                            {recentIngredients.length ? (
                                <View style={styles.miniBadge}>
                                    <Ionicons name="time-outline" size={13} color="#FFFFFF" />
                                    <Text style={styles.miniBadgeText}>
                                        {recentIngredients.length} recent ingredient{recentIngredients.length === 1 ? '' : 's'}
                                    </Text>
                                </View>
                            ) : null}
                        </View>
                    </View>

                    <View style={styles.stage}>
                        <View style={styles.sideRail}>
                            <Pressable
                                style={[
                                    styles.railButton,
                                    (cameraFacing === 'front' || (isWeb && !webTorchAvailable)) && styles.controlDisabled,
                                ]}
                                onPress={() => setTorchEnabled((current) => !current)}
                                disabled={cameraFacing === 'front' || (isWeb && !webTorchAvailable)}
                            >
                                <Ionicons
                                    name={
                                        cameraFacing === 'front' || (isWeb && !webTorchAvailable)
                                            ? 'flash-off-outline'
                                            : torchEnabled
                                                ? 'flash'
                                                : 'flash-outline'
                                    }
                                    size={20}
                                    color="#FFFFFF"
                                />
                            </Pressable>

                            <View style={styles.zoomRail}>
                                <Pressable style={styles.zoomIconButton} onPress={() => handleZoomStep(ZOOM_STEP)}>
                                    <Ionicons name="add" size={20} color="#FFFFFF" />
                                </Pressable>
                                <Text style={styles.zoomLabel}>{zoomLabel}</Text>
                                <Text style={styles.zoomCaption}>Pinch</Text>
                                <Pressable style={styles.zoomIconButton} onPress={() => handleZoomStep(-ZOOM_STEP)}>
                                    <Ionicons name="remove" size={20} color="#FFFFFF" />
                                </Pressable>
                                {zoom > 0.01 ? (
                                    <Pressable style={styles.zoomReset} onPress={() => setZoom(0)}>
                                        <Ionicons name="refresh" size={18} color="#FFFFFF" />
                                    </Pressable>
                                ) : null}
                            </View>
                        </View>

                        <View style={[styles.scanFrame, { width: frameWidth, height: frameHeight }]}>
                            <FrameCorner style={styles.frameCornerTopLeft} />
                            <FrameCorner style={styles.frameCornerTopRight} />
                            <FrameCorner style={styles.frameCornerBottomLeft} />
                            <FrameCorner style={styles.frameCornerBottomRight} />
                            <View style={styles.frameGuideHorizontal} />
                            <View style={styles.frameGuideVertical} />
                            <View style={styles.frameFocusWindow} />
                        </View>

                        <View style={styles.focusHint}>
                            <Ionicons name="scan-outline" size={16} color="#F6B44F" />
                            <Text style={styles.focusHintText}>
                                Center ingredients, then pinch to zoom for tighter framing.
                            </Text>
                        </View>
                    </View>

                    <View style={styles.bottomStack}>
                        <View style={styles.zoomPresetRow}>
                            {zoomPresets.map((preset) => {
                                const isActive = Math.abs(zoom - preset.value) < 0.05;

                                return (
                                    <Pressable
                                        key={preset.label}
                                        style={[styles.zoomPresetChip, isActive && styles.zoomPresetChipActive]}
                                        onPress={() => setZoom(preset.value)}
                                    >
                                        <Text style={[styles.zoomPresetText, isActive && styles.zoomPresetTextActive]}>
                                            {preset.label}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

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

                            <Pressable style={styles.sideControl} onPress={handlePickFromGallery}>
                                <Ionicons name="images-outline" size={24} color="#FFFFFF" />
                            </Pressable>
                        </View>

                        <Text style={styles.bottomHelperText}>
                            {isWeb
                                ? pictureSize
                                    ? `Web capture is using up to ${pictureSize} for clearer scans.`
                                    : 'Web capture is using the browser camera at full available detail.'
                                : pictureSize
                                    ? `High detail capture tuned to ${pictureSize}.`
                                    : 'High detail capture is enabled.'}
                        </Text>
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
    cameraPreviewShell: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#050A10',
    },
    cameraViewport: {
        overflow: 'hidden',
        backgroundColor: '#050A10',
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
    headerRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    headerButton: {
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
