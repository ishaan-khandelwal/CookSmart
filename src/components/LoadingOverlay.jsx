import { ActivityIndicator, Text, View } from 'react-native';

export default function LoadingOverlay({ visible, message }) {
    if (!visible) {
        return null;
    }

    return (
        <View className="absolute inset-0 items-center justify-center bg-[#0f1923c2] px-8">
            <View className="min-w-[220px] items-center rounded-[20px] border border-white/10 bg-card px-5 py-[22px]">
                <ActivityIndicator size="large" color="#00C896" />
                <Text className="mt-3.5 text-center text-[15px] font-semibold text-textPrimary">{message}</Text>
            </View>
        </View>
    );
}
