import { ActivityIndicator, Text, View } from 'react-native';

export default function LoadingOverlay({ visible, message }) {
    if (!visible) {
        return null;
    }

    return (
        <View className="absolute inset-0 items-center justify-center bg-[#061018d9] px-8">
            <View className="min-w-[250px] overflow-hidden rounded-[28px] border border-white/10 bg-[#0d1721] px-6 py-6">
                <View className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#f6b44f22]" />
                <View className="absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-[#00c89618]" />
                <View className="items-center">
                    <View className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                        <Text className="text-[11px] font-extrabold uppercase tracking-[1.4px] text-[#f6b44f]">CookSmart</Text>
                    </View>
                    <View className="mt-4">
                        <ActivityIndicator size="large" color="#F6B44F" />
                    </View>
                    <Text className="mt-4 text-center text-[16px] font-bold text-textPrimary">{message}</Text>
                    <Text className="mt-2 text-center text-[12px] leading-5 text-textSecondary">
                        Building a cleaner set of recipe suggestions for you.
                    </Text>
                </View>
            </View>
        </View>
    );
}
