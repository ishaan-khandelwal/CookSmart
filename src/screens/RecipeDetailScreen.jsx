import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingOverlay from '../components/LoadingOverlay';
import { fetchRecipeDetails } from '../services/spoonacularApi';

export default function RecipeDetailScreen({ navigation, route }) {
    const initialRecipe = route.params?.recipe ?? null;
    const recipeId = route.params?.recipeId ?? initialRecipe?.id;
    const [recipe, setRecipe] = useState(initialRecipe);
    const [loading, setLoading] = useState(Boolean(recipeId));
    const [errorMessage, setErrorMessage] = useState('');

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
                const details = await fetchRecipeDetails(recipeId);
                if (isMounted) {
                    setRecipe((current) => ({ ...current, ...details }));
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
    }, [recipeId]);

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScrollView contentContainerClassName="px-5 pt-2.5 pb-8" showsVerticalScrollIndicator={false}>
                <View className="mb-[18px] flex-row items-center justify-between">
                    <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-card" onPress={() => navigation.goBack()}>
                        <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
                    </Pressable>
                    <Text className="text-lg font-bold text-textPrimary">Recipe Detail</Text>
                    <View className="h-10 w-10" />
                </View>

                {recipe?.image ? (
                    <Image source={{ uri: recipe.image }} className="mb-5 h-[220px] w-full rounded-[24px] bg-card" resizeMode="cover" />
                ) : null}

                <View className="rounded-3xl border border-white/10 bg-card p-6">
                    <Text className="mb-3 text-2xl font-bold text-textPrimary">{recipe?.name ?? 'Recipe Detail'}</Text>

                    <View className="mb-4 flex-row flex-wrap gap-2">
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
                    </View>

                    {errorMessage ? (
                        <Text className="mb-4 text-sm leading-5 text-textSecondary">{errorMessage}</Text>
                    ) : null}

                    {recipe?.summary ? (
                        <>
                            <Text className="mb-2 text-lg font-bold text-textPrimary">Overview</Text>
                            <Text className="mb-5 text-[15px] leading-6 text-textSecondary">{recipe.summary}</Text>
                        </>
                    ) : null}

                    {recipe?.ingredients?.length ? (
                        <>
                            <Text className="mb-2 text-lg font-bold text-textPrimary">Ingredients</Text>
                            {recipe.ingredients.map((ingredient) => (
                                <Text key={ingredient} className="mb-2 text-[15px] leading-6 text-textSecondary">
                                    • {ingredient}
                                </Text>
                            ))}
                        </>
                    ) : null}

                    {recipe?.instructions ? (
                        <>
                            <Text className="mb-2 mt-5 text-lg font-bold text-textPrimary">Instructions</Text>
                            <Text className="text-[15px] leading-6 text-textSecondary">{recipe.instructions}</Text>
                        </>
                    ) : null}

                    {recipe?.sourceUrl ? (
                        <Pressable className="mt-6 items-center rounded-2xl bg-primary px-4 py-3.5" onPress={() => Linking.openURL(recipe.sourceUrl)}>
                            <Text className="text-[15px] font-bold text-background">Open Full Recipe</Text>
                        </Pressable>
                    ) : null}
                </View>
            </ScrollView>

            <LoadingOverlay visible={loading} message="Loading recipe details..." />
        </SafeAreaView>
    );
}
