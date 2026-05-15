import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingOverlay from '../components/LoadingOverlay';
import RecipeCard from '../components/RecipeCard';
import { DEFAULT_RECIPE_MODE, RECIPE_MODE_IDS, getRecipeModeMeta } from '../constants/recipeModes';
import { useAuth } from '../context/AuthContext';
import { useRecipeMode } from '../context/RecipeModeContext';
import { createHistory } from '../services/api';
import { findRealFavoriteImageFromTitle } from '../services/favoriteImageApi';
import { fetchRecipesByIngredients, getLocalRecipes, mergeRecipeSources } from '../services/spoonacularApi';
import { isNonVegRecipe, isVegRecipe } from '../utils/recipeDiet';

const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'veg', label: 'Veg' },
    { key: 'non-veg', label: 'Non-Veg' },
];

const RECENT_RECIPE_RESULTS_KEY = 'cooksmart:recentRecipeResults';

async function persistRecentRecipeResults(recipes, ingredients, provider, mode) {
    const payload = (Array.isArray(recipes) ? recipes : []).slice(0, 12).map((recipe) => ({
        ...recipe,
        selectedIngredients: ingredients,
        storedAt: new Date().toISOString(),
        sourceProvider: provider || recipe.provider || 'unknown',
        selectedMode: mode || DEFAULT_RECIPE_MODE,
    }));

    try {
        await AsyncStorage.setItem(RECENT_RECIPE_RESULTS_KEY, JSON.stringify(payload));
    } catch {
        // Planner can still work without local recent results.
    }
}

export default function RecipeResultsScreen({ navigation, route }) {
    const ingredients = route.params?.ingredients ?? [];
    const { selectedMode } = useRecipeMode();
    const { user } = useAuth();
    const activeMode = route.params?.mode || selectedMode || DEFAULT_RECIPE_MODE;
    const modeMeta = useMemo(() => getRecipeModeMeta(activeMode), [activeMode]);
    const [recipes, setRecipes] = useState([]);
    const [quota, setQuota] = useState(null);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    const [providerNotice, setProviderNotice] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');
    const [isFetching, setIsFetching] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const enrichRecipeImages = async (baseRecipes, provider) => {
            const recipesNeedingImages = (Array.isArray(baseRecipes) ? baseRecipes : [])
                .filter((recipe) => !String(recipe?.image || '').trim() && recipe?.name)
                .slice(0, 6);

            if (!recipesNeedingImages.length) {
                return;
            }

            const imageResults = await Promise.allSettled(
                recipesNeedingImages.map(async (recipe) => ({
                    id: recipe.id,
                    image: await findRealFavoriteImageFromTitle(recipe.name),
                })),
            );

            if (!isMounted) {
                return;
            }

            const resolvedImages = new Map(
                imageResults
                    .filter((result) => result.status === 'fulfilled' && result.value?.image)
                    .map((result) => [result.value.id, result.value.image]),
            );

            if (!resolvedImages.size) {
                return;
            }

            setRecipes((currentRecipes) => currentRecipes.map((recipe) => (
                resolvedImages.has(recipe.id)
                    ? { ...recipe, image: resolvedImages.get(recipe.id) }
                    : recipe
            )));

            const enrichedRecipes = baseRecipes.map((recipe) => (
                resolvedImages.has(recipe.id)
                    ? { ...recipe, image: resolvedImages.get(recipe.id) }
                    : recipe
            ));

            persistRecentRecipeResults(enrichedRecipes, ingredients, provider, activeMode).catch(() => {});
        };

        const loadRecipes = async () => {
            setLoading(true);
            setIsFetching(true);

            setErrorMessage('');
            setQuota(null);
            setProviderNotice('');

            try {
                const result = await fetchRecipesByIngredients(ingredients, { mode: activeMode });
                if (!isMounted) return;

                const nextRecipes = result?.recipes ?? [];
                setRecipes(prev => mergeRecipeSources(prev, nextRecipes));
                setQuota(result?.quota ?? null);
                setProviderNotice(result?.notice || '');
                persistRecentRecipeResults(nextRecipes, ingredients, result?.provider, activeMode).catch(() => {});
                enrichRecipeImages(nextRecipes, result?.provider).catch(() => {});

                if (user?.uid) {
                    const historyLabel = ingredients.length
                        ? `Recipe search: ${ingredients.slice(0, 3).join(', ')}`
                        : 'Recipe search: flexible inspiration';
                    createHistory({
                        userId: user.uid,
                        title: historyLabel,
                        type: 'recipe-search',
                        source: `${result?.provider || 'recipe-results'}:${activeMode}`,
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
                    setIsFetching(false);
                }
            }
        };

        loadRecipes();

        return () => {
            isMounted = false;
        };
    }, [activeMode, ingredients, user?.uid]);

    const filteredRecipes = useMemo(() => {
        if (activeFilter === 'veg') {
            return recipes.filter(isVegRecipe);
        }

        if (activeFilter === 'non-veg') {
            return recipes.filter(isNonVegRecipe);
        }

        return recipes;
    }, [activeFilter, recipes]);

    const missingRecipeCount = useMemo(
        () => filteredRecipes.filter((recipe) => Number(recipe?.missingCount || 0) > 0).length,
        [filteredRecipes],
    );
    const isCookFreedom = activeMode === RECIPE_MODE_IDS.COOK_FREEDOM;
    const heroLabel = isCookFreedom ? 'CookFreedom Studio' : 'PantryChef Matches';
    const heroTone = modeMeta.accent;
    const heroTitle = isCookFreedom
        ? `${filteredRecipes.length} recipe${filteredRecipes.length === 1 ? '' : 's'} you can explore right now.`
        : `${filteredRecipes.length} recipe${filteredRecipes.length === 1 ? '' : 's'} you can cook with what you have.`;
    const heroBody = isCookFreedom
        ? ingredients.length
            ? `Built around ${ingredients.length} ingredient${ingredients.length === 1 ? '' : 's'} you already have, while still allowing extra items when a better dish needs them.`
            : 'Browse full recipe suggestions first, then decide what to add to your basket before cooking.'
        : `Built from ${ingredients.length} ingredient${ingredients.length === 1 ? '' : 's'} you selected at home, without needing a market run.`;

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
                    <Text className="mt-3 text-[31px] font-black leading-9 text-white">{heroTitle}</Text>
                    <Text className="mt-3 max-w-[310px] text-[14px] leading-6 text-[#91A4B8]">
                        {heroBody}
                    </Text>

                    {ingredients.length ? (
                        <View className="mt-5 flex-row flex-wrap gap-2">
                            {ingredients.slice(0, 6).map((ingredient) => (
                                <View key={ingredient} className="rounded-full border border-white/8 bg-white/5 px-3.5 py-2">
                                    <Text className="text-[12px] font-semibold capitalize text-white">{ingredient}</Text>
                                </View>
                            ))}
                        </View>
                    ) : null}

                    <View className="mt-5 flex-row flex-wrap gap-3">
                        <View className="rounded-full border border-white/8 bg-white/5 px-4 py-2.5">
                            <Text className="text-[12px] font-semibold text-white">{recipes.length} total options</Text>
                        </View>
                        {isCookFreedom ? (
                            <View className="rounded-full border px-4 py-2.5 flex-row items-center" style={{ borderColor: `${heroTone}44`, backgroundColor: `${heroTone}18` }}>
                                <Ionicons name="sparkles" size={12} color={heroTone} />
                                <Text className="ml-2 text-[12px] font-semibold" style={{ color: '#F8D08B' }}>
                                    {missingRecipeCount ? `${missingRecipeCount} order-ready picks` : 'Flexible recipe ideas'}
                                </Text>
                            </View>
                        ) : (
                            <View className="rounded-full border border-[#00c89633] bg-[#00c89614] px-4 py-2.5 flex-row items-center">
                                <Ionicons name="checkmark-circle" size={12} color="#00C896" />
                                <Text className="ml-2 text-[12px] font-semibold text-[#9FE6D3]">Pantry-only recipes</Text>
                            </View>
                        )}
                        {typeof quota?.remaining === 'number' && recipes[0]?.provider === 'spoonacular' ? (
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

                {isFetching && !loading ? (
                    <View className="mb-4 flex-row items-center justify-center space-x-2 rounded-[22px] border border-[#F6B44F]/20 bg-[#F6B44F]/5 px-4 py-3">
                        <ActivityIndicator size="small" color="#F6B44F" />
                        <Text className="ml-2 text-sm font-medium text-[#F6B44F]">AI is searching for more recipes...</Text>
                    </View>
                ) : null}

                {errorMessage ? (
                    <View className="mb-4 rounded-[24px] border border-[#ff6b6b33] bg-[#2a1518] px-4 py-4">
                        <Text className="text-sm leading-6 text-textPrimary">{errorMessage}</Text>
                    </View>
                ) : null}

                {!loading && !errorMessage && !filteredRecipes.length ? (
                    <View className="rounded-[28px] border border-white/10 bg-[#0d1721] p-6">
                        <Text className="text-lg font-bold text-textPrimary">
                            {isCookFreedom ? 'No CookFreedom ideas yet' : 'No pantry-only recipe matches yet'}
                        </Text>
                        <Text className="mt-2 text-sm leading-6 text-textSecondary">
                            {isCookFreedom
                                ? 'Try adding a few ingredients or switch back to PantryChef if you want stricter matches from your current kitchen.'
                                : 'Try scanning more of what you already have at home so CookSmart can build fuller recipes without adding outside ingredients.'}
                        </Text>
                    </View>
                ) : null}

                <View className="mt-1">
                    {filteredRecipes.map((recipe) => (
                        <RecipeCard
                            key={recipe.id}
                            recipe={recipe}
                            mode={activeMode}
                            onPress={() => navigation.navigate('RecipeDetail', {
                                recipeId: recipe.id,
                                recipe,
                                selectedIngredients: ingredients,
                                mode: activeMode,
                            })}
                        />
                    ))}
                </View>
            </ScrollView>

            <LoadingOverlay visible={loading} message="Finding recipes..." />
        </SafeAreaView>
    );
}
