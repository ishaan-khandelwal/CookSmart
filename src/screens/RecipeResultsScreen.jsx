import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingOverlay from '../components/LoadingOverlay';
import { useAuth } from '../context/AuthContext';
import { createHistory } from '../services/api';
import RecipeCard from '../components/RecipeCard';
import { fetchRecipesByIngredients } from '../services/spoonacularApi';

const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'veg', label: 'Veg' },
    { key: 'non-veg', label: 'Non-Veg' },
];

export default function RecipeResultsScreen({ navigation, route }) {
    const ingredients = route.params?.ingredients ?? [];
    const { user } = useAuth();
    const [recipes, setRecipes] = useState([]);
    const [quota, setQuota] = useState(null);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');

    useEffect(() => {
        let isMounted = true;

        const loadRecipes = async () => {
            setLoading(true);
            setErrorMessage('');
            setQuota(null);

            try {
                const result = await fetchRecipesByIngredients(ingredients);
                if (!isMounted) {
                    return;
                }

                const nextRecipes = result?.recipes ?? [];
                setRecipes(nextRecipes);
                setQuota(result?.quota ?? null);

                if (user?.uid) {
                    createHistory({
                        userId: user.uid,
                        title: `Recipe search: ${ingredients.slice(0, 3).join(', ')}`,
                        type: 'recipe-search',
                        source: result?.provider || 'recipe-results',
                        ingredients,
                        resultCount: nextRecipes.length,
                    }).catch(() => {});
                }
            } catch (error) {
                if (!isMounted) {
                    return;
                }

                if (error?.code === 'MISSING_API_KEY') {
                    setErrorMessage('Spoonacular API key is missing. Add EXPO_PUBLIC_SPOONACULAR_API_KEY and restart Expo.');
                } else if (error?.code === 'AUTH_ERROR') {
                    setErrorMessage(error?.message || 'Spoonacular rejected the API key or quota is exhausted.');
                } else {
                    setErrorMessage(error?.message || 'Could not load recipes right now. Try again in a moment.');
                }
                setRecipes([]);
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        loadRecipes();

        return () => {
            isMounted = false;
        };
    }, [ingredients, user?.uid]);

    const filteredRecipes = useMemo(() => {
        if (activeFilter === 'veg') {
            return recipes.filter((recipe) => recipe.vegetarian === true || recipe.vegan === true);
        }

        if (activeFilter === 'non-veg') {
            return recipes.filter((recipe) => recipe.vegetarian === false && recipe.vegan !== true);
        }

        return recipes;
    }, [activeFilter, recipes]);

    return (
        <SafeAreaView className="flex-1 bg-background px-5 pt-2.5">
            <View className="mb-[18px] flex-row items-center justify-between">
                <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-card" onPress={() => navigation.goBack()}>
                    <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
                </Pressable>
                <Text className="text-xl font-bold text-textPrimary">Recipe Matches</Text>
                <View className="h-10 w-10" />
            </View>

            <View className="mb-4 rounded-[20px] border border-white/10 bg-card p-[18px]">
                <Text className="mb-1.5 text-lg font-bold text-textPrimary">
                    CookSmart found {filteredRecipes.length} recipe{filteredRecipes.length === 1 ? '' : 's'}
                </Text>
                <Text className="text-sm leading-5 text-textSecondary">
                    Built around {ingredients.length} ingredient{ingredients.length === 1 ? '' : 's'} from your search.
                </Text>
                {typeof quota?.remaining === 'number' ? (
                    <View className="mt-3 self-start rounded-full bg-white/5 px-3 py-2">
                        <Text className="text-xs font-semibold text-textPrimary">
                            Spoonacular credits left: {quota.remaining.toFixed(2)} / {quota.dailyLimit}
                        </Text>
                    </View>
                ) : null}
            </View>

            <View className="mb-4 flex-row gap-2">
                {FILTERS.map((filter) => {
                    const selected = activeFilter === filter.key;
                    return (
                        <Pressable
                            key={filter.key}
                            className={`rounded-full border px-4 py-2 ${selected ? 'border-primary bg-primary' : 'border-white/10 bg-card'}`}
                            onPress={() => setActiveFilter(filter.key)}
                        >
                            <Text className={`text-sm font-bold ${selected ? 'text-background' : 'text-textPrimary'}`}>
                                {filter.label}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>

            {errorMessage ? (
                <View className="mb-4 rounded-2xl border border-[#ff6b6b40] bg-[#ff6b6b14] p-4">
                    <Text className="text-sm leading-5 text-textPrimary">{errorMessage}</Text>
                </View>
            ) : null}

            <ScrollView contentContainerClassName="pb-6" showsVerticalScrollIndicator={false}>
                {!loading && !errorMessage && !filteredRecipes.length ? (
                    <View className="rounded-3xl border border-white/10 bg-card p-6">
                        <Text className="mb-2 text-lg font-bold text-textPrimary">No recipe matches yet</Text>
                        <Text className="text-sm leading-5 text-textSecondary">
                            Try another filter or scan again with staple ingredients like onion, tomato, pasta, rice, or eggs.
                        </Text>
                    </View>
                ) : null}

                {filteredRecipes.map((recipe) => (
                    <RecipeCard
                        key={recipe.id}
                        recipe={recipe}
                        onPress={() => navigation.navigate('RecipeDetail', {
                            recipeId: recipe.id,
                            recipe,
                            selectedIngredients: ingredients,
                        })}
                    />
                ))}
            </ScrollView>

            <LoadingOverlay visible={loading} message="Finding recipes..." />
        </SafeAreaView>
    );
}
