import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { RECIPE_MODE_IDS } from '../constants/recipeModes';
import { getRecipeDietLabel, getRecipeDietTone } from '../utils/recipeDiet';

const difficultyStripe = {
    Easy: '#00C896',
    Medium: '#F59E0B',
    Hard: '#FF6B6B',
};

export default function RecipeCard({ recipe, onPress, mode = RECIPE_MODE_IDS.PANTRY_CHEF }) {
    const stripeColor = difficultyStripe[recipe.difficulty] ?? '#00C896';
    const dietLabel = getRecipeDietLabel(recipe);
    const dietColor = getRecipeDietTone(recipe);
    const isCookFreedom = mode === RECIPE_MODE_IDS.COOK_FREEDOM;
    const providerLabel = isCookFreedom
        ? recipe.provider === 'gemini' ? 'Flexible pick' : recipe.provider === 'edamam' ? 'Recipe to explore' : 'CookFreedom pick'
        : recipe.provider === 'gemini' ? 'Pantry recipe' : recipe.provider === 'edamam' ? 'Home match' : 'Pantry match';

    return (
        <Pressable className="mb-4 overflow-hidden rounded-[28px] border border-white/10 bg-[#0d1721]" onPress={onPress}>
            <View className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundColor: stripeColor }} />
            {recipe.image ? (
                <Image source={{ uri: recipe.image }} style={styles.image} resizeMode="cover" />
            ) : (
                <View style={styles.imageFallback}>
                    <View className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                        <Text className="text-[12px] font-black uppercase tracking-[1.4px] text-[#F6B44F]">{providerLabel}</Text>
                    </View>
                    <Text className="mt-4 text-[28px] font-black text-textPrimary">{recipe.imageLabel}</Text>
                </View>
            )}
            <View className="px-5 pb-5 pt-4">
                <View className="mb-3 flex-row items-start justify-between">
                    <View className="flex-1 pr-4">
                        <Text className="text-[11px] font-extrabold uppercase tracking-[1.4px] text-[#F6B44F]">{providerLabel}</Text>
                        <Text className="mt-2 text-[22px] font-black leading-7 text-textPrimary">{recipe.name}</Text>
                    </View>
                    <View className="items-end">
                        <View className="rounded-full px-3 py-1.5" style={{ backgroundColor: `${stripeColor}20` }}>
                            <Text className="text-[11px] font-black uppercase tracking-[0.8px]" style={{ color: stripeColor }}>{recipe.difficulty}</Text>
                        </View>
                        <View className="mt-2 rounded-full px-3 py-1.5" style={{ backgroundColor: `${dietColor}20` }}>
                            <Text className="text-[11px] font-black uppercase tracking-[0.8px]" style={{ color: dietColor }}>{dietLabel}</Text>
                        </View>
                    </View>
                </View>

                <Text className="text-[14px] leading-6 text-textSecondary" numberOfLines={2}>
                    {recipe.summary || 'Clean, practical recipe ideas built from your selected ingredients.'}
                </Text>

                <View className="mt-4 flex-row flex-wrap gap-2">
                    <View className="rounded-full border border-white/8 bg-white/5 px-3 py-2">
                        <Text className="text-[12px] font-semibold text-textPrimary">{recipe.cookTime}</Text>
                    </View>
                    {isCookFreedom ? (
                        <View className="rounded-full border border-[#f59e0b30] bg-[#f59e0b14] px-3 py-2">
                            <Text className="text-[12px] font-semibold text-[#F8D08B]">
                                {recipe.missingCount > 0
                                    ? `Need ${recipe.missingCount} more ingredient${recipe.missingCount === 1 ? '' : 's'}`
                                    : 'Ready with your kitchen'}
                            </Text>
                        </View>
                    ) : (
                        <View className="rounded-full border border-[#00c89630] bg-[#00c89614] px-3 py-2">
                            <Text className="text-[12px] font-semibold text-[#9FE6D3]">
                                Uses {recipe.matchingCount} ingredient{recipe.matchingCount === 1 ? '' : 's'} you have
                            </Text>
                        </View>
                    )}
                    {Array.isArray(recipe.pantryStaples) && recipe.pantryStaples.length ? (
                        <View className="rounded-full border border-white/8 bg-white/5 px-3 py-2">
                            <Text className="text-[12px] font-semibold text-[#F8D08B]">
                                Pantry basics only
                            </Text>
                        </View>
                    ) : null}
                </View>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    image: {
        width: '100%',
        height: 190,
        backgroundColor: '#152435',
    },
    imageFallback: {
        width: '100%',
        height: 190,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#152435',
    },
});
