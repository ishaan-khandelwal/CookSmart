import { ActivityIndicator, Pressable, Text, View } from 'react-native';

export default function WebcamCaptureStatusBanner({
    loading = false,
    loadingMessage = '',
    errorMessage = '',
    uploadedFile = null,
    onDismissError,
}) {
    if (loading) {
        return (
            <View className="rounded-[20px] border border-[#F6B44F]/20 bg-[#0d1721]/85 px-4 py-3">
                <View className="flex-row items-center">
                    <ActivityIndicator size="small" color="#F6B44F" />
                    <Text className="ml-3 flex-1 text-[13px] font-semibold text-white">
                        {loadingMessage || 'Processing camera image...'}
                    </Text>
                </View>
            </View>
        );
    }

    if (errorMessage) {
        return (
            <View className="rounded-[20px] border border-[#ff6b6b33] bg-[#2a1518]/90 px-4 py-3">
                <View className="flex-row items-start justify-between">
                    <Text className="mr-3 flex-1 text-[13px] leading-5 text-white">{errorMessage}</Text>
                    {onDismissError ? (
                        <Pressable onPress={onDismissError}>
                            <Text className="text-[12px] font-bold uppercase tracking-[0.8px] text-[#FF9A9A]">Dismiss</Text>
                        </Pressable>
                    ) : null}
                </View>
            </View>
        );
    }

    if (uploadedFile?.filename) {
        return (
            <View className="rounded-[20px] border border-[#00c89633] bg-[#0d1721]/85 px-4 py-3">
                <Text className="text-[12px] font-bold uppercase tracking-[1px] text-[#89E3CC]">Upload Ready</Text>
                <Text className="mt-1 text-[13px] text-white">{uploadedFile.filename}</Text>
            </View>
        );
    }

    return null;
}
