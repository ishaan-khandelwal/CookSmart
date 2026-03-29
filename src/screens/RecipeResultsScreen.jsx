import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingOverlay from '../components/LoadingOverlay';
import RecipeCard from '../components/RecipeCard';
import { useAuth } from '../context/AuthContext';
import { createHistory } from '../services/api';
import { fetchRecipesByIngredients } from '../services/spoonacularApi';

const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'veg', label: 'Veg' },
    { key: 'non-veg', label: 'Non-Veg' },
];

const RECENT_RECIPE_RESULTS_KEY = 'cooksmart:recentRecipeResults';

async function persistRecentRecipeResults(recipes, ingredients, provider) {
    const payload = (Array.isArray(recipes) ? recipes : []).slice(0, 12).map((recipe) => ({
        ...recipe,
        selectedIngredients: ingredients,
        storedAt: new Date().toISOString(),
        sourceProvider: provider || recipe.provider || 'unknown',
    }));

    try {
        await AsyncStorage.setItem(RECENT_RECIPE_RESULTS_KEY, JSON.stringify(payload));
    } catch {
        // Planner can still work without local recent results.
    }
}

export default function RecipeResultsScreen({ navigation, route }) {
    const ingredients = route.params?.ingredients ?? [];
    const { user } = useAuth();
    const [recipes, setRecipes] = useState([]);
    const [quota, setQuota] = useState(null);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    const [providerNotice, setProviderNotice] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');

    useEffect(() => {
        let isMounted = true;

        const loadRecipes = async () => {
            setLoading(true);
            setErrorMessage('');
            setQuota(null);
            setProviderNotice('');

            try {
                const result = await fetchRecipesByIngredients(ingredients);
                if (!isMounted) return;

                const nextRecipes = result?.recipes ?? [];
                setRecipes(nextRecipes);
                setQuota(result?.quota ?? null);
                setProviderNotice(result?.notice || '');
                persistRecentRecipeResults(nextRecipes, ingredients, result?.provider).catch(() => {});

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
                if (!isMounted) return;
                setErrorMessage(error?.message || 'Could not load recipes right now. Try again in a moment.');
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

    const primaryProvider = recipes[0]?.provider || '';
    const heroLabel = primaryProvider === 'gemini' ? 'AI Recipe Studio' : primaryProvider === 'edamam' ? 'Curated Web Picks' : 'Pantry Recipe Matches';
    const heroTone = primaryProvider === 'gemini' ? '#F6B44F' : primaryProvider === 'edamam' ? '#60A5FA' : '#00C896';

    return (
        <SafeAreaView className="flex-1 bg-[#07141d]">
            <ScrollView contentContainerClassName="px-5 pb-8 pt-2.5" showsVerticalScrollIndicator={false}>
                <View className="mb-[18px] flex-row items-center justify-between">
                    <Pressable className="h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#0d1721]" onPress={() => navigation.goBack()}>
                        <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
                    </Pressable>
                    <Text className="text-xl font-bold text-textPrimary">Recipe Matches</Text>
                    <View className="h-11 w-11" />
                </View>

                <View className="overflow-hidden rounded-[34px] border border-white/10 bg-[#0d1721] px-5 pb-5 pt-6">
                    <View className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#f6b44f22]" />
                    <View className="absolute -bottom-14 -left-10 h-32 w-32 rounded-full bg-[#00c89612]" />
                    <Text className="text-[11px] font-extrabold uppercase tracking-[1.6px]" style={{ color: heroTone }}>
                        {heroLabel}
                    </Text>
                    <Text className="mt-3 text-[31px] font-black leading-9 text-white">
                        {filteredRecipes.length} recipe{filteredRecipes.length === 1 ? '' : 's'} shaped around your ingredients.
                    </Text>
                    <Text className="mt-3 max-w-[310px] text-[14px] leading-6 text-[#91A4B8]">
                        Built from {ingredients.length} ingredient{ingredients.length === 1 ? '' : 's'} you selected, with a cleaner path from search to cooking steps.
                    </Text>

                    <View className="mt-5 flex-row flex-wrap gap-2">
                        {ingredients.slice(0, 6).map((ingredient) => (
                            <View key={ingredient} className="rounded-full border border-white/8 bg-white/5 px-3.5 py-2">
                                <Text className="text-[12px] font-semibold capitalize text-white">{ingredient}</Text>
                            </View>
                        ))}
                    </View>

                    <View className="mt-5 flex-row flex-wrap gap-3">
                        <View className="rounded-full border border-white/8 bg-white/5 px-4 py-2.5">
                            <Text className="text-[12px] font-semibold text-white">{recipes.length} total options</Text>
                        </View>
                        {primaryProvider === 'gemini' ? (
                            <View className="rounded-full border border-[#f6b44f33] bg-[#f6b44f14] px-4 py-2.5 flex-row items-center">
                                <Ionicons name="sparkles" size={12} color="#F6B44F" />
                                <Text className="ml-2 text-[12px] font-semibold text-[#F8D08B]">AI-curated recipes</Text>
                            </View>
                        ) : null}
                        {typeof quota?.remaining === 'number' && primaryProvider === 'spoonacular' ? (
                            <View className="rounded-full border border-white/8 bg-white/5 px-4 py-2.5">
                                <Text className="text-[12px] font-semibold text-white">{quota.remaining.toFixed(0)} Spoonacular credits left</Text>
                            </View>
                        ) : null}
                    </View>
                </View>

                <View className="mb-5 mt-5 flex-row gap-2">
                    {FILTERS.map((filter) => {
                        const selected = activeFilter === filter.key;
                        return (
                            <Pressable
                                key={filter.key}
                                className={`rounded-full border px-4 py-2.5 ${selected ? 'border-[#F6B44F] bg-[#F6B44F]' : 'border-white/10 bg-[#0d1721]'}`}
                                onPress={() => setActiveFilter(filter.key)}
                            >
                                <Text className={`text-sm font-bold ${selected ? 'text-[#08131c]' : 'text-textPrimary'}`}>
                                    {filter.label}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>

                {providerNotice ? (
                    <View className="mb-4 rounded-[22px] border border-white/10 bg-[#0d1721] px-4 py-3.5">
                        <Text className="text-sm leading-6 text-[#B5C3D1]">{providerNotice}</Text>
                    </View>
                ) : null}

                {errorMessage ? (
                    <View className="mb-4 rounded-[24px] border border-[#ff6b6b33] bg-[#2a1518] px-4 py-4">
                        <Text className="text-sm leading-6 text-textPrimary">{errorMessage}</Text>
                    </View>
                ) : null}

                {!loading && !errorMessage && !filteredRecipes.length ? (
                    <View className="rounded-[28px] border border-white/10 bg-[#0d1721] p-6">
                        <Text className="text-lg font-bold text-textPrimary">No recipe matches yet</Text>
                        <Text className="mt-2 text-sm leading-6 text-textSecondary">
                            Try scanning again with pantry staples like onion, tomato, rice, eggs, herbs, or pasta for stronger matches.
                        </Text>
                    </View>
                ) : null}

                <View className="mt-1">
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
                </View>
            </ScrollView>

            <LoadingOverlay visible={loading} message="Finding recipes..." />
        </SafeAreaView>
    );
}
