import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    RefreshControl,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { createFavorite, fetchFavorites } from '../services/api';

export default function FavoritesScreen({ navigation }) {
    const { user } = useAuth();
    const [favorites, setFavorites] = useState([]);
    const [newTitle, setNewTitle] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);

    const userId = user?.uid;

    const emptyMessage = useMemo(() => {
        if (!userId) {
            return 'Sign in to sync favorites with MongoDB.';
        }

        return 'No favorites saved yet. Add one below to test the database connection.';
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
            setFavorites(Array.isArray(data) ? data : []);
        } catch (error) {
            Alert.alert('Load Failed', error.message);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [userId]);

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

            const createdFavorite = await createFavorite({
                title,
                userId,
                source: 'favorites-screen',
            });

            setFavorites((currentFavorites) => {
                const nextFavorites = currentFavorites.filter((item) => item._id !== createdFavorite._id);
                return [createdFavorite, ...nextFavorites];
            });
            setNewTitle('');
            Alert.alert('Saved', 'Recipe added to favorites.');
        } catch (error) {
            Alert.alert('Save Failed', error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <View className="flex-1 bg-[#111111] px-5 pt-16">
            <View className="mb-6">
                <Text className="text-xs font-extrabold uppercase tracking-[1px] text-[#22C55E]">MongoDB Favorites</Text>
                <Text className="mt-2 text-[30px] font-extrabold text-white">Saved recipes</Text>
                <Text className="mt-2 text-sm leading-6 text-white/65">
                    This screen reads and writes favorites through your Express API and MongoDB.
                </Text>
            </View>

            <View className="mb-5 rounded-[24px] border border-white/10 bg-[#181818] p-4">
                <Text className="mb-2 text-sm font-semibold text-white">Add a favorite</Text>
                <TextInput
                    value={newTitle}
                    onChangeText={setNewTitle}
                    placeholder="Example: Garlic Mushroom Pasta"
                    placeholderTextColor="#94A3B8"
                    className="rounded-2xl border border-white/10 bg-[#101010] px-4 py-3 text-white"
                />
                <TouchableOpacity
                    className={`mt-3 items-center rounded-2xl px-4 py-3 ${saving || !newTitle.trim() ? 'bg-[#22C55E]/50' : 'bg-[#22C55E]'}`}
                    activeOpacity={0.85}
                    onPress={handleAddFavorite}
                    disabled={saving || !newTitle.trim()}
                >
                    <Text className="text-sm font-extrabold text-[#111111]">
                        {saving ? 'Saving...' : 'Save to MongoDB'}
                    </Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#22C55E" />
                </View>
            ) : (
                <FlatList
                    data={favorites}
                    keyExtractor={(item) => item._id}
                    refreshControl={(
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => loadFavorites(true)}
                            tintColor="#22C55E"
                        />
                    )}
                    contentContainerStyle={{ paddingBottom: 24, flexGrow: favorites.length ? 0 : 1 }}
                    ListEmptyComponent={(
                        <View className="flex-1 items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-[#151515] px-6 py-10">
                            <Text className="text-center text-sm leading-6 text-white/60">{emptyMessage}</Text>
                        </View>
                    )}
                    renderItem={({ item }) => (
                        <View className="mb-3 rounded-[22px] border border-white/10 bg-[#181818] p-4">
                            <View className="flex-row items-center">
                                {item.image ? (
                                    <Image
                                        source={{ uri: item.image }}
                                        className="mr-4 h-[64px] w-[64px] rounded-2xl bg-[#101010]"
                                        resizeMode="cover"
                                    />
                                ) : (
                                    <View className="mr-4 h-[64px] w-[64px] items-center justify-center rounded-2xl bg-[#101010]">
                                        <Text className="text-[11px] font-bold uppercase tracking-[1px] text-white/45">Recipe</Text>
                                    </View>
                                )}
                                <View className="flex-1">
                                    <Text className="text-lg font-bold text-white">{item.title}</Text>
                                    <Text className="mt-1 text-xs uppercase tracking-[1px] text-white/45">
                                        {item.provider || item.source || 'manual'}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    )}
                />
            )}
        </View>
    );
}
