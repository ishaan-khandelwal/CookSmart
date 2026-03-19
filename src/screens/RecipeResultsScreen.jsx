import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingOverlay from '../components/LoadingOverlay';
import RecipeCard from '../components/RecipeCard';
import { fetchRecipesByIngredients } from '../services/spoonacularApi';

export default function RecipeResultsScreen({ navigation, route }) {
    const ingredients = route.params?.ingredients ?? [];
    const [recipes, setRecipes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        let isMounted = true;

        const loadRecipes = async () => {
            setLoading(true);
            setErrorMessage('');

            try {
                const nextRecipes = await fetchRecipesByIngredients(ingredients);
                if (isMounted) {
                    setRecipes(nextRecipes);
                }
            } catch (error) {
                if (!isMounted) {
                    return;
                }

                if (error?.code === 'MISSING_API_KEY') {
                    setErrorMessage('Spoonacular API key is missing. Add EXPO_PUBLIC_SPOONACULAR_API_KEY and restart Expo.');
                } else if (error?.code === 'AUTH_ERROR') {
                    setErrorMessage('Spoonacular rejected the API key or quota is exhausted.');
                } else {
                    setErrorMessage('Could not load recipes right now. Try again in a moment.');
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
    }, [ingredients]);

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
                    CookSmart found {recipes.length} recipe{recipes.length === 1 ? '' : 's'}
                </Text>
                <Text className="text-sm leading-5 text-textSecondary">
                    Built around {ingredients.length} ingredient{ingredients.length === 1 ? '' : 's'} from your scan.
                </Text>
            </View>

            {errorMessage ? (
                <View className="mb-4 rounded-2xl border border-[#ff6b6b40] bg-[#ff6b6b14] p-4">
                    <Text className="text-sm leading-5 text-textPrimary">{errorMessage}</Text>
                </View>
            ) : null}

            <ScrollView contentContainerClassName="pb-6" showsVerticalScrollIndicator={false}>
                {!loading && !errorMessage && !recipes.length ? (
                    <View className="rounded-3xl border border-white/10 bg-card p-6">
                        <Text className="mb-2 text-lg font-bold text-textPrimary">No recipe matches yet</Text>
                        <Text className="text-sm leading-5 text-textSecondary">
                            Try scanning again with a few staple ingredients like onion, tomato, pasta, rice, or eggs.
                        </Text>
                    </View>
                ) : null}

                {recipes.map((recipe) => (
                    <RecipeCard
                        key={recipe.id}
                        recipe={recipe}
                        onPress={() => navigation.navigate('RecipeDetail', { recipeId: recipe.id, recipe })}
                    />
                ))}
            </ScrollView>

            <LoadingOverlay visible={loading} message="Finding recipes..." />
        </SafeAreaView>
    );
}
