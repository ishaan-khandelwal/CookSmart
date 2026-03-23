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
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingOverlay from '../components/LoadingOverlay';
import { detectIngredientsFromImage } from '../services/claudeApi';

const RECENT_SCAN_KEY = 'cooksmart:lastScan';

export default function CameraScanScreen({ navigation }) {
    const cameraRef = useRef(null);
    const [permission, requestPermission] = useCameraPermissions();
    const [cameraFacing, setCameraFacing] = useState('back');
    const [isProcessing, setIsProcessing] = useState(false);
    const [recentIngredients, setRecentIngredients] = useState([]);
    const [lastPhotoUri, setLastPhotoUri] = useState(null);

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

    const processImageUri = useCallback(
        async (uri) => {
            setIsProcessing(true);
            setLastPhotoUri(uri);

            try {
                const base64Image = await FileSystem.readAsStringAsync(uri, {
                    encoding: FileSystem.EncodingType.Base64,
                });

                const ingredients = await detectIngredientsFromImage(base64Image);
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
                quality: 0.8,
                skipProcessing: false,
            });

            if (photo?.uri) {
                await processImageUri(photo.uri);
            }
        } catch {
            Alert.alert('Camera error', 'Could not capture the photo. Please try again.');
        }
    }, [isProcessing, processImageUri]);

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
                quality: 0.9,
                allowsEditing: false,
            });

            if (!result.canceled && result.assets?.[0]?.uri) {
                await processImageUri(result.assets[0].uri);
            }
        } catch {
            Alert.alert('Gallery error', 'Could not open the gallery. Please try again.');
        }
    }, [isProcessing, processImageUri]);

    const handleRetryLastPhoto = useCallback(() => {
        if (lastPhotoUri) {
            processImageUri(lastPhotoUri);
        }
    }, [lastPhotoUri, processImageUri]);

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
        <View className="flex-1 bg-background">
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing={cameraFacing} />
            <SafeAreaView className="flex-1 justify-between px-5 pt-2.5" edges={['top', 'left', 'right']}>
                <View className="flex-row items-center justify-between">
                    <Pressable className="h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#0f1923b3]" onPress={handleBack}>
                        <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
                    </Pressable>
                    <Text className="text-lg font-bold text-textPrimary">Scan Ingredients</Text>
                    <View className="h-10 w-10" />
                </View>

                <View className="mt-[18px] w-full max-w-[320px] self-center rounded-3xl border border-white/10 bg-[#0f19239e] p-[18px]">
                    <Text className="mb-2 text-center text-xl font-bold text-textPrimary">
                        Center your ingredients in the frame
                    </Text>
                    <Text className="text-center text-sm leading-5 text-textSecondary">
                        Fresh produce, packaged items, and pantry staples all work best in bright light.
                    </Text>
                </View>

                {recentIngredients.length > 0 ? (
                    <View className="mb-40 rounded-[22px] border border-white/10 bg-[#0f1923b3] p-4">
                        <Text className="mb-3 text-sm font-bold text-textPrimary">Recently scanned</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="pr-3">
                            {recentIngredients.map((ingredient) => (
                                <View key={ingredient} className="mr-2.5 rounded-full border border-primary bg-[#00c8961f] px-[14px] py-2">
                                    <Text className="text-[13px] font-semibold text-textPrimary">{ingredient}</Text>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                ) : (
                    <View />
                )}
            </SafeAreaView>

            <SafeAreaView className="absolute bottom-0 left-0 right-0 px-5 pb-5" edges={['bottom', 'left', 'right']}>
                <View className="flex-row items-center justify-between rounded-[28px] border border-white/10 bg-[#0f1923d6] px-[26px] py-4">
                    <Pressable
                        className="h-[52px] w-[52px] items-center justify-center rounded-full bg-card"
                        onPress={() => setCameraFacing((current) => (current === 'back' ? 'front' : 'back'))}
                    >
                        <Ionicons name="camera-reverse-outline" size={24} color="#FFFFFF" />
                    </Pressable>

                    <Pressable className="h-[84px] w-[84px] items-center justify-center rounded-full border-4 border-primary bg-white/20" onPress={handleCapture} disabled={isProcessing}>
                        <View className="h-[70px] w-[70px] rounded-full bg-white" />
                    </Pressable>

                    <Pressable className="h-[52px] w-[52px] items-center justify-center rounded-full bg-card" onPress={handlePickFromGallery}>
                        <Ionicons name="images-outline" size={24} color="#FFFFFF" />
                    </Pressable>
                </View>

                {lastPhotoUri ? (
                    <Pressable className="mt-3 self-center px-4 py-2" onPress={handleRetryLastPhoto}>
                        <Text className="text-sm font-semibold text-textPrimary">Retry last photo</Text>
                    </Pressable>
                ) : null}
            </SafeAreaView>

            <LoadingOverlay visible={isProcessing} message="Identifying ingredients..." />
        </View>
    );
}
