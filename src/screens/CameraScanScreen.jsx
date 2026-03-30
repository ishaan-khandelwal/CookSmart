import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
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
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingOverlay from '../components/LoadingOverlay';
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

function FrameCorner({ style }) {
    return <View pointerEvents="none" style={[styles.frameCorner, style]} />;
}

export default function CameraScanScreen({ navigation }) {
    const cameraRef = useRef(null);
    const [permission, requestPermission] = useCameraPermissions();
    const [cameraFacing, setCameraFacing] = useState('back');
    const [isProcessing, setIsProcessing] = useState(false);
    const [recentIngredients, setRecentIngredients] = useState([]);
    const [lastPhotoUri, setLastPhotoUri] = useState(null);
    const isWeb = Platform.OS === 'web';
    const recentPreview = recentIngredients.slice(0, 6);

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
        if (!cameraRef.current || isProcessing) {
            return;
        }

        try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch {
            // Haptics are optional.
        }

        try {
            const photo = await cameraRef.current.takePictureAsync({
                quality: isWeb ? 0.92 : 0.82,
                base64: true,
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
    }, [isProcessing, isWeb, processImageAsset]);

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

    const handleRetryLastPhoto = useCallback(() => {
        if (lastPhotoUri) {
            processImageAsset({ uri: lastPhotoUri, mimeType: inferMimeType(lastPhotoUri) });
        }
    }, [lastPhotoUri, processImageAsset]);

    const handleBack = useCallback(() => {
        if (navigation.canGoBack()) {
            navigation.goBack();
            return;
        }

        navigation.navigate('MainTabs', { screen: 'Home' });
    }, [navigation]);

    if (!permission) {
        return (
            <View className="flex-1 items-center justify-center bg-background px-6">
                <Text className="text-[22px] font-bold text-textPrimary">Preparing camera...</Text>
            </View>
        );
    }

    if (!permission.granted) {
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
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing={cameraFacing} />

            <View pointerEvents="none" style={styles.cameraOverlay}>
                <View style={styles.overlayGlowTop} />
                <View style={styles.overlayGlowBottom} />
                <View style={styles.overlayShadeTop} />
                <View style={styles.overlayShadeBottom} />
            </View>

            <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
                <View style={styles.headerRow}>
                    <Pressable style={styles.headerButton} onPress={handleBack}>
                        <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
                    </Pressable>

                    <View style={styles.headerTextWrap}>
                        <Text className="text-center text-[28px] font-black text-white">Scan Ingredients</Text>
                        <Text className="mt-1 text-center text-[13px] leading-5 text-white/70">
                            Capture one clear shot and let CookSmart sort the pantry for you.
                        </Text>
                    </View>

                    <View style={styles.headerSpacer} />
                </View>

                <View style={styles.stage}>
                    <View style={styles.tipRow}>
                        <View style={styles.tipPill}>
                            <Ionicons name="sunny-outline" size={15} color="#F6B44F" />
                            <Text className="ml-2 text-[12px] font-bold text-white">Bright light</Text>
                        </View>
                        <View style={styles.tipPill}>
                            <Ionicons name="scan-outline" size={15} color="#F6B44F" />
                            <Text className="ml-2 text-[12px] font-bold text-white">Fill the frame</Text>
                        </View>
                    </View>

                    <View style={[styles.scanFrame, isWeb && styles.scanFrameWeb]}>
                        <View style={styles.scanBadge}>
                            <Text className="text-[11px] font-black uppercase tracking-[1.8px] text-[#F6B44F]">
                                Scan zone
                            </Text>
                        </View>
                        <View style={styles.frameCenterLine} />
                        <FrameCorner style={styles.frameCornerTopLeft} />
                        <FrameCorner style={styles.frameCornerTopRight} />
                        <FrameCorner style={styles.frameCornerBottomLeft} />
                        <FrameCorner style={styles.frameCornerBottomRight} />
                    </View>

                    <View style={styles.guidanceCard}>
                        <Text className="text-center text-[24px] font-black leading-8 text-white">
                            Aim for detail, not distance
                        </Text>
                        <Text style={styles.guidanceBody}>
                            Keep the main ingredients inside the frame with a little spacing so the scanner can
                            separate produce, labels, and pantry items more accurately.
                        </Text>
                    </View>
                </View>
            </SafeAreaView>

            <SafeAreaView style={styles.bottomArea} edges={['bottom', 'left', 'right']}>
                {recentPreview.length > 0 ? (
                    <View style={styles.recentPanel}>
                        <View className="mb-3 flex-row items-center justify-between">
                            <Text style={styles.recentLabel}>Recent scan</Text>
                            <Text className="text-[12px] font-semibold text-[#F6B44F]">
                                {recentPreview.length} item{recentPreview.length === 1 ? '' : 's'}
                            </Text>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentContent}>
                            {recentPreview.map((ingredient) => (
                                <View key={ingredient} style={styles.recentChip}>
                                    <Text className="text-[13px] font-semibold text-white">{ingredient}</Text>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                ) : (
                    <View style={styles.tipStrip}>
                        <Ionicons name="sparkles-outline" size={16} color="#F6B44F" />
                        <Text style={styles.tipStripText}>
                            Best results come from a single layer of ingredients with minimal shadow.
                        </Text>
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

                    <Pressable style={styles.sideControl} onPress={handlePickFromGallery}>
                        <Ionicons name="images-outline" size={24} color="#FFFFFF" />
                    </Pressable>
                </View>

                <View style={styles.helperRow}>
                    <Text style={styles.helperText}>
                        High-detail capture is enabled for cleaner scan results.
                    </Text>
                    {lastPhotoUri ? (
                        <Pressable style={styles.retryButton} onPress={handleRetryLastPhoto}>
                            <Text className="text-[13px] font-bold text-[#F6B44F]">Retry last photo</Text>
                        </Pressable>
                    ) : null}
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
        paddingHorizontal: 16,
    },
    headerSpacer: {
        width: 46,
        height: 46,
    },
    stage: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 28,
    },
    tipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 10,
        marginBottom: 22,
    },
    tipPill: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: 'rgba(7,16,24,0.7)',
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    scanFrame: {
        width: '100%',
        maxWidth: 312,
        aspectRatio: 0.92,
        borderRadius: 34,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.18)',
        backgroundColor: 'rgba(5, 10, 16, 0.12)',
        overflow: 'hidden',
    },
    scanFrameWeb: {
        maxWidth: 344,
    },
    scanBadge: {
        position: 'absolute',
        top: 18,
        alignSelf: 'center',
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: 'rgba(7,16,24,0.75)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    frameCenterLine: {
        position: 'absolute',
        left: '18%',
        right: '18%',
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
        marginTop: 24,
        width: '100%',
        maxWidth: 320,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(7,16,24,0.74)',
        paddingHorizontal: 22,
        paddingVertical: 20,
    },
    guidanceBody: {
        marginTop: 12,
        textAlign: 'center',
        fontSize: 14,
        lineHeight: 24,
        color: 'rgba(255,255,255,0.72)',
    },
    bottomArea: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 20,
        paddingBottom: 18,
    },
    recentPanel: {
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(7,16,24,0.82)',
        paddingHorizontal: 16,
        paddingVertical: 16,
        marginBottom: 14,
    },
    recentLabel: {
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.55)',
    },
    recentContent: {
        paddingRight: 10,
    },
    recentChip: {
        marginRight: 10,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(246,180,79,0.18)',
        backgroundColor: 'rgba(246,180,79,0.12)',
        paddingHorizontal: 14,
        paddingVertical: 9,
    },
    tipStrip: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(7,16,24,0.78)',
        paddingHorizontal: 15,
        paddingVertical: 12,
        marginBottom: 14,
    },
    tipStripText: {
        marginLeft: 8,
        flex: 1,
        fontSize: 13,
        lineHeight: 20,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.72)',
    },
    controlDock: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 32,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: 'rgba(7,16,24,0.88)',
        paddingHorizontal: 20,
        paddingVertical: 14,
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
        width: 102,
        height: 102,
        borderRadius: 51,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(246,180,79,0.7)',
        backgroundColor: 'rgba(246,180,79,0.08)',
    },
    shutterInnerRing: {
        width: 84,
        height: 84,
        borderRadius: 42,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 5,
        borderColor: '#FFFFFF',
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    shutterCore: {
        width: 62,
        height: 62,
        borderRadius: 31,
        backgroundColor: '#F6B44F',
    },
    helperRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 12,
        paddingHorizontal: 4,
    },
    helperText: {
        flex: 1,
        fontSize: 12,
        lineHeight: 20,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.58)',
    },
    retryButton: {
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
});
