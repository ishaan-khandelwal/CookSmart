import { Image, Pressable, Text, View } from 'react-native';

const difficultyStripe = {
    Easy: '#00C896',
    Medium: '#F59E0B',
    Hard: '#FF6B6B',
};

export default function RecipeCard({ recipe, onPress }) {
    const stripeColor = difficultyStripe[recipe.difficulty] ?? '#00C896';
    const dietLabel = recipe.vegan ? 'Vegan' : recipe.vegetarian ? 'Veg' : 'Non-Veg';
    const dietColor = recipe.vegan || recipe.vegetarian ? '#22C55E' : '#FF6B6B';

    return (
        <Pressable className="mb-3.5 flex-row items-center overflow-hidden rounded-xl border border-white/10 bg-card" onPress={onPress}>
            <View className="w-2 self-stretch" style={{ backgroundColor: stripeColor }} />
            {recipe.image ? (
                <Image source={{ uri: recipe.image }} className="m-3.5 h-[78px] w-[78px] rounded-xl bg-[#233146]" resizeMode="cover" />
            ) : (
                <View className="m-3.5 h-[78px] w-[78px] items-center justify-center rounded-xl bg-[#233146]">
                    <Text className="text-[13px] font-bold text-textPrimary">{recipe.imageLabel}</Text>
                </View>
            )}
            <View className="flex-1 py-3.5 pr-3.5">
                <View className="mb-2 flex-row items-start justify-between">
                    <Text className="mr-2.5 flex-1 text-base font-bold text-textPrimary">{recipe.name}</Text>
                    <View className="items-end">
                        <View className="rounded-full px-2.5 py-1.5" style={{ backgroundColor: `${stripeColor}22` }}>
                            <Text className="text-xs font-bold" style={{ color: stripeColor }}>{recipe.difficulty}</Text>
                        </View>
                        <View className="mt-1 rounded-full px-2.5 py-1.5" style={{ backgroundColor: `${dietColor}22` }}>
                            <Text className="text-[11px] font-bold" style={{ color: dietColor }}>{dietLabel}</Text>
                        </View>
                    </View>
                </View>
                <Text className="mb-1 text-[13px] text-textSecondary">{recipe.cookTime}</Text>
                <Text className="text-[13px] font-semibold text-textPrimary">
                    {recipe.matchingCount} matching ingredient{recipe.matchingCount === 1 ? '' : 's'}
                </Text>
                {typeof recipe.missingCount === 'number' ? (
                    <Text className="mt-1 text-[12px] text-textSecondary">
                        {recipe.missingCount} ingredient{recipe.missingCount === 1 ? '' : 's'} still needed
                    </Text>
                ) : null}
            </View>
        </Pressable>
    );
}
