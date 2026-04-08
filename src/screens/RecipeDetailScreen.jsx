import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingOverlay from '../components/LoadingOverlay';
import { DEFAULT_RECIPE_MODE, RECIPE_MODE_IDS, getRecipeModeMeta } from '../constants/recipeModes';
import { useAuth } from '../context/AuthContext';
import { useRecipeMode } from '../context/RecipeModeContext';
import { createFavorite, createHistory } from '../services/api';
import { generateFavoriteImageFromTitle } from '../services/favoriteImageApi';
import { fetchRecipeDetails } from '../services/spoonacularApi';
import { getRecipeDietFlags, getRecipeDietLabel, getRecipeDietTone } from '../utils/recipeDiet';

const DETAIL_SECTIONS = [
    { key: 'overview', label: 'Overview' },
    { key: 'ingredients', label: 'Ingredients' },
    { key: 'steps', label: 'Steps' },
];

function normalizeIngredient(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\b(cup|cups|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons|oz|ounce|ounces|lb|pound|pounds|g|kg|ml|l)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function uniqueList(items) {
    return Array.from(new Set((items || []).map((item) => String(item).trim()).filter(Boolean)));
}

function getIngredientBuckets(recipe, selectedIngredients) {
    const usedIngredients = uniqueList(recipe?.usedIngredients);
    const pantryStaples = uniqueList(recipe?.pantryStaples);
    const missingIngredients = uniqueList(recipe?.missingIngredients);

    if (usedIngredients.length || pantryStaples.length || missingIngredients.length) {
        return {
            have: usedIngredients,
            pantryStaples,
            missing: missingIngredients,
        };
    }

    const available = new Set((selectedIngredients || []).map(normalizeIngredient).filter(Boolean));
    const allIngredients = uniqueList(recipe?.ingredients);
    const have = [];
    const pantryStaplesFallback = [];

    allIngredients.forEach((ingredient) => {
        const normalizedIngredient = normalizeIngredient(ingredient);
        const matches = Array.from(available).some(
            (item) => normalizedIngredient.includes(item) || item.includes(normalizedIngredient),
        );

        if (matches) {
            have.push(ingredient);
        } else {
            pantryStaplesFallback.push(ingredient);
        }
    });

    return { have, pantryStaples: pantryStaplesFallback, missing: [] };
}

export default function RecipeDetailScreen({ navigation, route }) {
    const initialRecipe = route.params?.recipe ?? null;
    const recipeId = route.params?.recipeId ?? initialRecipe?.id;
    const selectedIngredients = route.params?.selectedIngredients ?? [];
    const { selectedMode } = useRecipeMode();
    const { user } = useAuth();
    const activeMode = route.params?.mode || selectedMode || DEFAULT_RECIPE_MODE;
    const modeMeta = useMemo(() => getRecipeModeMeta(activeMode), [activeMode]);
    const [recipe, setRecipe] = useState(initialRecipe);
    const [loading, setLoading] = useState(Boolean(recipeId));
    const [errorMessage, setErrorMessage] = useState('');
    const [activeSection, setActiveSection] = useState('overview');
    const [savingFavorite, setSavingFavorite] = useState(false);

    const ingredientBuckets = useMemo(
        () => getIngredientBuckets(recipe, selectedIngredients),
        [recipe, selectedIngredients],
    );

    const dietLabel = getRecipeDietLabel(recipe);
    const dietTone = getRecipeDietTone(recipe);
    const instructionSteps = recipe?.instructionSteps?.length ? recipe.instructionSteps : [];
    const isCookFreedom = activeMode === RECIPE_MODE_IDS.COOK_FREEDOM;

    useEffect(() => {
        let isMounted = true;

        const loadRecipe = async () => {
            if (!recipeId) {
                setLoading(false);
                setErrorMessage('Recipe details are unavailable.');
                return;
            }

            setLoading(true);
            setErrorMessage('');

            try {
                const details = await fetchRecipeDetails(
                    {
                        id: recipeId,
                        provider: initialRecipe?.provider,
                    },
                    initialRecipe,
                );
                if (!isMounted) {
                    return;
                }

                setRecipe((current) => ({ ...current, ...details }));

                if (user?.uid) {
                    createHistory({
                        userId: user.uid,
                        title: details.name || initialRecipe?.name || 'Recipe detail view',
                        type: 'recipe-detail',
                        source: 'recipe-detail',
                        ingredients: selectedIngredients,
                    }).catch(() => {});
                }
            } catch (error) {
                if (isMounted) {
                    setErrorMessage('Could not load recipe details right now.');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        loadRecipe();

        return () => {
            isMounted = false;
        };
    }, [initialRecipe?.name, recipeId, selectedIngredients, user?.uid]);

    const handleSaveFavorite = async () => {
        if (!user?.uid) {
            Alert.alert('Login Required', 'Sign in before saving recipes to favorites.');
            return;
        }

        if (!recipe?.name) {
            return;
        }

        try {
            setSavingFavorite(true);
            const fallbackImage = recipe?.image ? '' : await generateFavoriteImageFromTitle(recipe.name, process.env.EXPO_PUBLIC_GEMINI_KEY);
            const dietFlags = getRecipeDietFlags(recipe);
            await createFavorite({
                recipeId: recipe.providerId || recipe.id || '',
                provider: recipe.provider || 'manual',
                title: recipe.name,
                image: recipe.image || fallbackImage,
                vegetarian: dietFlags.vegetarian,
                vegan: dietFlags.vegan,
                source: 'recipe-detail',
                userId: user.uid,
            });
            Alert.alert('Saved', 'Recipe added to favorites.');
        } catch (error) {
            Alert.alert('Save Failed', error.message);
        } finally {
            setSavingFavorite(false);
        }
    };

    const handleOrderIngredients = () => {
        const missingList = ingredientBuckets.missing.slice(0, 6).join(', ');
        Alert.alert(
            'Order Ingredients',
            missingList
                ? `CookSmart would open an ordering flow for: ${missingList}.`
                : 'This recipe is already covered by what you have, so there is nothing extra to order.',
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScrollView contentContainerClassName="px-5 pt-2.5 pb-8" showsVerticalScrollIndicator={false}>
                <View className="mb-[18px] flex-row items-center justify-between">
                    <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-card" onPress={() => navigation.goBack()}>
                        <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
                    </Pressable>
                    <Text className="text-lg font-bold text-textPrimary">Recipe Detail</Text>
                    <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-card" onPress={handleSaveFavorite}>
                        <Ionicons name={savingFavorite ? 'time-outline' : 'heart-outline'} size={20} color="#FFFFFF" />
                    </Pressable>
                </View>

                <View className="overflow-hidden rounded-[28px] border border-white/10 bg-card">
                    {recipe?.image ? (
                        <Image source={{ uri: recipe.image }} className="h-[240px] w-full bg-card" resizeMode="cover" />
                    ) : (
                        <View className="h-[240px] items-center justify-center bg-[#192231]">
                            <Text className="text-lg font-bold text-textPrimary">CookSmart Recipe</Text>
                        </View>
                    )}

                    <View className="p-6">
                        <View className="mb-4 flex-row items-start justify-between">
                            <View className="flex-1 pr-3">
                                <Text className="text-2xl font-bold text-textPrimary">{recipe?.name ?? 'Recipe Detail'}</Text>
                                <Text className="mt-2 text-sm leading-5 text-textSecondary">
                                    {isCookFreedom
                                        ? 'A full recipe breakdown with the items you already have and what you may want to order.'
                                        : 'Smart cooking breakdown based on the ingredients you selected.'}
                                </Text>
                            </View>
                            <View className="rounded-full px-3 py-2" style={{ backgroundColor: `${dietTone}22` }}>
                                <Text className="text-xs font-bold" style={{ color: dietTone }}>{dietLabel}</Text>
                            </View>
                        </View>

                        <View className="mb-5 flex-row flex-wrap gap-2">
                            {recipe?.readyInMinutes ? (
                                <View className="rounded-full bg-white/5 px-3 py-2">
                                    <Text className="text-xs font-semibold text-textPrimary">{recipe.readyInMinutes} min</Text>
                                </View>
                            ) : null}
                            {recipe?.servings ? (
                                <View className="rounded-full bg-white/5 px-3 py-2">
                                    <Text className="text-xs font-semibold text-textPrimary">{recipe.servings} servings</Text>
                                </View>
                            ) : null}
                            <View className="rounded-full bg-white/5 px-3 py-2">
                                    <Text className="text-xs font-semibold text-textPrimary">
                                        {ingredientBuckets.have.length} from your scan
                                    </Text>
                                </View>
                                <View className="rounded-full px-3 py-2" style={{ backgroundColor: `${modeMeta.accent}18` }}>
                                    <Text className="text-xs font-semibold" style={{ color: modeMeta.accent }}>{modeMeta.shortTitle}</Text>
                                </View>
                                {ingredientBuckets.pantryStaples.length ? (
                                    <View className="rounded-full bg-white/5 px-3 py-2">
                                        <Text className="text-xs font-semibold text-textPrimary">Pantry basics assumed</Text>
                                    </View>
                                ) : null}
                            </View>

                        <View className="mb-5 gap-3">
                            <Pressable className="items-center rounded-2xl bg-primary px-4 py-3.5" onPress={handleSaveFavorite}>
                                <Text className="text-[15px] font-bold text-background">
                                    {savingFavorite ? 'Saving...' : 'Save Recipe'}
                                </Text>
                            </Pressable>
                            {isCookFreedom && ingredientBuckets.missing.length ? (
                                <Pressable className="items-center rounded-2xl border border-[#f59e0b55] bg-[#f59e0b14] px-4 py-3.5" onPress={handleOrderIngredients}>
                                    <Text className="text-[15px] font-bold text-[#F8D08B]">Order Ingredients</Text>
                                </Pressable>
                            ) : null}
                            {recipe?.sourceUrl ? (
                                <Pressable className="items-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5" onPress={() => Linking.openURL(recipe.sourceUrl)}>
                                    <Text className="text-[15px] font-bold text-textPrimary">Open Source</Text>
                                </Pressable>
                            ) : null}
                        </View>

                        {errorMessage ? (
                            <Text className="mb-4 text-sm leading-5 text-textSecondary">{errorMessage}</Text>
                        ) : null}

                        <View className="mb-5 flex-row gap-2">
                            {DETAIL_SECTIONS.map((section) => {
                                const selected = activeSection === section.key;
                                return (
                                    <Pressable
                                        key={section.key}
                                        className={`rounded-full border px-4 py-2 ${selected ? 'border-primary bg-primary' : 'border-white/10 bg-white/5'}`}
                                        onPress={() => setActiveSection(section.key)}
                                    >
                                        <Text className={`text-sm font-bold ${selected ? 'text-background' : 'text-textPrimary'}`}>
                                            {section.label}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        {activeSection === 'overview' ? (
                            <View className="rounded-[24px] border border-white/10 bg-[#111927] p-4">
                                <Text className="mb-2 text-lg font-bold text-textPrimary">Overview</Text>
                                <Text className="text-[15px] leading-6 text-textSecondary">
                                    {recipe?.summary || 'No summary available for this recipe yet.'}
                                </Text>
                            </View>
                        ) : null}

                        {activeSection === 'ingredients' ? (
                            <View>
                                {recipe?.ingredients?.length ? (
                                    <View className="rounded-[24px] border border-white/10 bg-[#111927] p-4">
                                        <Text className="mb-3 text-lg font-bold text-textPrimary">Ingredients</Text>
                                        {recipe.ingredients.map((ingredient) => (
                                            <Text key={ingredient} className="mb-2 text-[15px] leading-6 text-textSecondary">
                                                - {ingredient}
                                            </Text>
                                        ))}
                                    </View>
                                ) : null}

                                {(ingredientBuckets.have.length || ingredientBuckets.missing.length || ingredientBuckets.pantryStaples.length) ? (
                                    <View className="mt-4 rounded-[24px] border border-white/10 bg-[#111927] p-4">
                                        <Text className="mb-1 text-lg font-bold text-textPrimary">
                                            {isCookFreedom ? 'Kitchen Match Breakdown' : 'Cook From What You Have'}
                                        </Text>
                                        <Text className="mb-4 text-sm leading-5 text-textSecondary">
                                            {isCookFreedom
                                                ? 'CookFreedom keeps the full recipe visible, then shows exactly what you already have and what still needs to be picked up.'
                                                : 'This recipe is filtered to fit what you already have at home.'}
                                        </Text>

                                        <View className="mb-4 rounded-2xl border border-[#00c89633] bg-[#00c89614] p-4">
                                            <View className="mb-3 flex-row items-center">
                                                <Ionicons name="checkmark-circle" size={18} color="#00C896" />
                                                <Text className="ml-2 text-base font-bold text-textPrimary">From your ingredients</Text>
                                            </View>
                                            {ingredientBuckets.have.length ? (
                                                ingredientBuckets.have.map((ingredient) => (
                                                    <Text key={`have-${ingredient}`} className="mb-2 text-[15px] leading-6 text-textPrimary">
                                                        - {ingredient}
                                                    </Text>
                                                ))
                                            ) : (
                                                <Text className="text-sm leading-5 text-textSecondary">
                                                    CookSmart matched this recipe using your scanned pantry context.
                                                </Text>
                                            )}
                                        </View>

                                        {ingredientBuckets.pantryStaples.length ? (
                                            <View className="rounded-2xl border border-white/10 bg-background/30 p-4">
                                                <View className="mb-3 flex-row items-center">
                                                    <Ionicons name="restaurant-outline" size={18} color="#F6B44F" />
                                                    <Text className="ml-2 text-base font-bold text-textPrimary">Pantry basics</Text>
                                                </View>
                                                {ingredientBuckets.pantryStaples.map((ingredient) => (
                                                    <Text key={`staple-${ingredient}`} className="mb-2 text-[15px] leading-6 text-textPrimary">
                                                        - {ingredient}
                                                    </Text>
                                                ))}
                                            </View>
                                        ) : null}

                                        {ingredientBuckets.missing.length ? (
                                            <View className="mt-4 rounded-2xl border border-[#ffb54733] bg-[#ffb54714] p-4">
                                                <View className="mb-3 flex-row items-center">
                                                    <Ionicons name="alert-circle-outline" size={18} color="#FFB547" />
                                                    <Text className="ml-2 text-base font-bold text-textPrimary">
                                                        {isCookFreedom ? 'Missing ingredients' : 'Check this recipe'}
                                                    </Text>
                                                </View>
                                                {ingredientBuckets.missing.map((ingredient) => (
                                                    <Text key={`missing-${ingredient}`} className="mb-2 text-[15px] leading-6 text-textPrimary">
                                                        - {ingredient}
                                                    </Text>
                                                ))}
                                                <Text className="mt-1 text-sm leading-5 text-textSecondary">
                                                    {isCookFreedom
                                                        ? 'You can keep the full recipe and order these items directly before cooking.'
                                                        : 'This recipe still references a few extra items, so you may want to use the pantry-only matches list instead.'}
                                                </Text>
                                                {isCookFreedom ? (
                                                    <Pressable className="mt-4 items-center rounded-2xl bg-[#F59E0B] px-4 py-3.5" onPress={handleOrderIngredients}>
                                                        <Text className="text-[15px] font-bold text-[#08131c]">Order Ingredients</Text>
                                                    </Pressable>
                                                ) : null}
                                            </View>
                                        ) : null}
                                    </View>
                                ) : null}
                            </View>
                        ) : null}

                        {activeSection === 'steps' ? (
                            <View className="rounded-[24px] border border-white/10 bg-[#111927] p-4">
                                <Text className="mb-3 text-lg font-bold text-textPrimary">Cooking Steps</Text>
                                {instructionSteps.length ? (
                                    instructionSteps.map((step, index) => (
                                        <View key={`${index + 1}-${step}`} className="mb-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                                            <Text className="mb-2 text-xs font-bold uppercase tracking-[1px] text-primary">Step {index + 1}</Text>
                                            <Text className="text-[15px] leading-6 text-textPrimary">{step}</Text>
                                        </View>
                                    ))
                                ) : recipe?.instructions ? (
                                    <Text className="text-[15px] leading-6 text-textSecondary">{recipe.instructions}</Text>
                                ) : (
                                    <Text className="text-[15px] leading-6 text-textSecondary">No step-by-step instructions are available for this recipe.</Text>
                                )}
                            </View>
                        ) : null}
                    </View>
                </View>
            </ScrollView>

            <LoadingOverlay visible={loading} message="Loading recipe details..." />
        </SafeAreaView>
    );
}
