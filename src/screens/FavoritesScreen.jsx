import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BOTTOM_TAB_BAR_RESERVED_SPACE } from '../components/BottomTabBar';
import { useAuth } from '../context/AuthContext';
import { createFavorite, fetchFavorites } from '../services/api';
import { findRealFavoriteImageFromTitle, generateFavoriteImageFromTitle } from '../services/favoriteImageApi';
import { getRecipeDietLabel, isNonVegRecipe, isVegRecipe } from '../utils/recipeDiet';

const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'veg', label: 'Veg' },
    { key: 'non-veg', label: 'Non-Veg' },
];

function canRenderFavoriteImage(uri) {
    const value = String(uri || '').trim();
    return Boolean(value) && !/^data:image\/svg\+xml/i.test(value);
}

function shouldUpgradeFavoriteImage(uri) {
    const value = String(uri || '').trim().toLowerCase();
    if (!value) {
        return true;
    }

    return /^data:image\//i.test(value) || value.includes('placehold.co');
}

export default function FavoritesScreen({ navigation }) {
    const { user } = useAuth();
    const [favorites, setFavorites] = useState([]);
    const [newTitle, setNewTitle] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isVegetarian, setIsVegetarian] = useState(true);
    const [activeFilter, setActiveFilter] = useState('all');

    const userId = user?.uid;

    const emptyMessage = useMemo(() => {
        if (!userId) {
            return 'Sign in to build a synced recipe collection.';
        }

        if (activeFilter === 'veg') {
            return 'No veg favorites yet. Save one from recipe results or add one below.';
        }

        if (activeFilter === 'non-veg') {
            return 'No non-veg favorites yet. Save one from recipe results or add one below.';
        }

        return 'No saved recipes yet. Add one below or save a recipe from the AI results flow.';
    }, [activeFilter, userId]);

    const filteredFavorites = useMemo(() => {
        if (activeFilter === 'veg') {
            return favorites.filter(isVegRecipe);
        }

        if (activeFilter === 'non-veg') {
            return favorites.filter(isNonVegRecipe);
        }

        return favorites;
    }, [activeFilter, favorites]);

    const refreshFavoriteImages = useCallback(async (items) => {
        if (!userId || !Array.isArray(items) || !items.length) {
            return;
        }

        for (const item of items) {
            if (!item?.title || !shouldUpgradeFavoriteImage(item.image)) {
                continue;
            }

            try {
                const realImage = await findRealFavoriteImageFromTitle(item.title);
                if (!realImage || realImage === item.image) {
                    continue;
                }

                const updatedFavorite = await createFavorite({
                    recipeId: item.recipeId || '',
                    provider: item.provider || 'manual',
                    title: item.title,
                    image: realImage,
                    vegetarian: Boolean(item.vegetarian),
                    vegan: Boolean(item.vegan),
                    userId,
                    source: item.source || 'favorites-screen',
                });

                setFavorites((currentFavorites) => currentFavorites.map((favorite) => (
                    favorite._id === item._id || favorite.title === item.title ? updatedFavorite : favorite
                )));
            } catch {
                // Keep the current image if the upgrade lookup fails.
            }
        }
    }, [userId]);

    const loadFavorites = useCallback(async (showRefresh = false) => {
        if (!userId) {
            setFavorites([]);
            setLoading(false);
            setRefreshing(false);
            return;
        }

        try {
            if (showRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            const data = await fetchFavorites(userId);
            const favoritesList = Array.isArray(data) ? data : [];
            setFavorites(favoritesList);
            refreshFavoriteImages(favoritesList);
        } catch (error) {
            Alert.alert('Load Failed', error.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [refreshFavoriteImages, userId]);

    useEffect(() => {
        loadFavorites();
    }, [loadFavorites]);

    useEffect(() => {
        const unsubscribe = navigation?.addListener?.('focus', () => {
            loadFavorites(true);
        });

        return unsubscribe;
    }, [loadFavorites, navigation]);

    const handleAddFavorite = async () => {
        const title = newTitle.trim();

        if (!userId) {
            Alert.alert('Login Required', 'Please sign in before saving favorites.');
            return;
        }

        if (!title) {
            Alert.alert('Missing Title', 'Enter a recipe title first.');
            return;
        }

        try {
            setSaving(true);
            const generatedImage = await generateFavoriteImageFromTitle(title, process.env.EXPO_PUBLIC_GEMINI_KEY);

            const createdFavorite = await createFavorite({
                title,
                image: generatedImage,
                vegetarian: isVegetarian,
                userId,
                source: 'favorites-screen',
            });

            setFavorites((currentFavorites) => {
                const nextFavorites = currentFavorites.filter((item) => item._id !== createdFavorite._id);
                return [createdFavorite, ...nextFavorites];
            });
            setNewTitle('');
        } catch (error) {
            Alert.alert('Save Failed', error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-[#07141d]" edges={['top', 'left', 'right']}>
            <FlatList
                data={filteredFavorites}
                keyExtractor={(item) => item._id}
                showsVerticalScrollIndicator={false}
                refreshControl={(
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => loadFavorites(true)}
                        tintColor="#F6B44F"
                    />
                )}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: BOTTOM_TAB_BAR_RESERVED_SPACE + 24 }}
                ListHeaderComponent={(
                    <View>
                        <View className="mb-5 mt-2">
                            <View>
                                <Text className="text-[11px] font-extrabold uppercase tracking-[1.8px] text-[#F6B44F]">Saved Collection</Text>
                                <Text className="mt-2 text-[32px] font-black text-white">Favorites</Text>
                                <Text className="mt-2 max-w-[300px] text-sm leading-6 text-[#93A6B8]">
                                    Keep your best meals, AI finds, and pantry staples in one clean archive.
                                </Text>
                            </View>
                            <View className="mt-4 self-start rounded-full border border-white/10 bg-white/5 px-4 py-2.5">
                                <Text className="text-[12px] font-semibold text-white">{filteredFavorites.length} saved</Text>
                            </View>
                        </View>

                        <View className="mb-6 overflow-hidden rounded-[32px] border border-white/10 bg-[#0d1721] px-5 pb-5 pt-6">
                            <View className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#f6b44f1f]" />
                            <View className="absolute -bottom-14 -left-10 h-32 w-32 rounded-full bg-[#00c89614]" />
                            <Text className="text-[11px] font-extrabold uppercase tracking-[1.6px] text-[#F6B44F]">Manual Save</Text>
                            <Text className="mt-3 text-[24px] font-black leading-8 text-white">Add a recipe you want to keep on hand.</Text>

                            <TextInput
                                value={newTitle}
                                onChangeText={setNewTitle}
                                placeholder="Recipe title"
                                placeholderTextColor="#64788C"
                                className="mt-5 rounded-[20px] border border-white/10 bg-[#08131c] px-4 py-4 text-white"
                            />

                            <View className="mt-3 rounded-[20px] border border-[#F6B44F]/20 bg-[#F6B44F]/8 px-4 py-3">
                                <Text className="text-[11px] font-black uppercase tracking-[1px] text-[#F6B44F]">Auto Image</Text>
                                <Text className="mt-1 text-sm leading-5 text-[#D0D8E2]">
                                    CookSmart will look for a real food photo first, then fall back to generated art only if needed.
                                </Text>
                            </View>

                            <View className="mt-4 flex-row gap-2">
                                <TouchableOpacity
                                    onPress={() => setIsVegetarian(true)}
                                    className={`rounded-full px-4 py-2.5 ${isVegetarian ? 'bg-[#00C896]' : 'border border-white/10 bg-white/5'}`}
                                    activeOpacity={0.85}
                                >
                                    <Text className={`text-[12px] font-black uppercase tracking-[0.8px] ${isVegetarian ? 'text-[#08131c]' : 'text-white/70'}`}>Veg</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setIsVegetarian(false)}
                                    className={`rounded-full px-4 py-2.5 ${!isVegetarian ? 'bg-[#F6B44F]' : 'border border-white/10 bg-white/5'}`}
                                    activeOpacity={0.85}
                                >
                                    <Text className={`text-[12px] font-black uppercase tracking-[0.8px] ${!isVegetarian ? 'text-[#08131c]' : 'text-white/70'}`}>Non-Veg</Text>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                className={`mt-5 items-center rounded-[22px] px-4 py-4 ${saving || !newTitle.trim() ? 'bg-[#F6B44F]/40' : 'bg-[#F6B44F]'}`}
                                activeOpacity={0.85}
                                onPress={handleAddFavorite}
                                disabled={saving || !newTitle.trim()}
                            >
                                <Text className="text-[14px] font-black uppercase tracking-[1px] text-[#08131c]">
                                    {saving ? 'Generating Image...' : 'Add To Favorites'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View className="mb-5 flex-row gap-2">
                            {FILTERS.map((filter) => {
                                const selected = activeFilter === filter.key;
                                return (
                                    <TouchableOpacity
                                        key={filter.key}
                                        className={`rounded-full border px-4 py-2.5 ${selected ? 'border-[#F6B44F] bg-[#F6B44F]' : 'border-white/10 bg-[#0d1721]'}`}
                                        onPress={() => setActiveFilter(filter.key)}
                                        activeOpacity={0.85}
                                    >
                                        <Text className={`text-sm font-bold ${selected ? 'text-[#08131c]' : 'text-white'}`}>
                                            {filter.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {loading ? (
                            <View className="items-center justify-center py-16">
                                <ActivityIndicator size="large" color="#F6B44F" />
                            </View>
                        ) : null}
                    </View>
                )}
                ListEmptyComponent={!loading ? (
                    <View className="items-center rounded-[28px] border border-dashed border-white/10 bg-[#0d1721] px-6 py-10">
                        <Text className="text-center text-sm leading-6 text-[#A4B5C5]">{emptyMessage}</Text>
                    </View>
                ) : null}
                renderItem={({ item }) => {
                    const isVeg = isVegRecipe(item);
                    const dietLabel = getRecipeDietLabel(item);
                    const hasRenderableImage = canRenderFavoriteImage(item.image);
                    return (
                        <View className="mb-4 overflow-hidden rounded-[28px] border border-white/10 bg-[#0d1721]">
                            {hasRenderableImage ? (
                                <Image
                                    source={{ uri: item.image }}
                                    style={styles.favoriteImage}
                                    resizeMode="cover"
                                />
                            ) : (
                                <View style={styles.favoriteImageFallback}>
                                    <Text className="text-[13px] font-black uppercase tracking-[1.4px] text-[#F6B44F]">Saved Recipe</Text>
                                </View>
                            )}
                            <View className="px-5 pb-5 pt-4">
                                <View className="flex-row items-start justify-between">
                                    <View className="flex-1 pr-4">
                                        <Text className="text-[12px] font-extrabold uppercase tracking-[1.4px] text-[#F6B44F]">
                                            {item.provider || item.source || 'manual'}
                                        </Text>
                                        <Text className="mt-2 text-[22px] font-black leading-7 text-white">{item.title}</Text>
                                    </View>
                                    <View className={`rounded-full px-3 py-1.5 ${isVeg ? 'bg-[#00c89620]' : 'bg-[#ff6b6b20]'}`}>
                                        <Text className={`text-[11px] font-black uppercase tracking-[0.8px] ${isVeg ? 'text-[#89E3CC]' : 'text-[#FF9A9A]'}`}>
                                            {dietLabel}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    );
                }}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    favoriteImage: {
        width: '100%',
        height: 180,
        backgroundColor: '#101b27',
    },
    favoriteImageFallback: {
        width: '100%',
        height: 180,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#101b27',
    },
});
