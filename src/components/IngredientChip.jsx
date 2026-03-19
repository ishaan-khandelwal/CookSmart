import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';

export default function IngredientChip({ label, onRemove, delay = 0 }) {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(12)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration: 220,
                delay,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: 0,
                duration: 220,
                delay,
                useNativeDriver: true,
            }),
        ]).start();
    }, [delay, opacity, translateY]);

    return (
        <Animated.View className="mb-2.5 mr-2.5" style={{ opacity, transform: [{ translateY }] }}>
            <View className="flex-row items-center rounded-full border border-primary bg-[#00c89614] px-3.5 py-2.5">
                <Text className="mr-2 text-sm font-semibold text-textPrimary">{label}</Text>
                <Pressable onPress={onRemove} hitSlop={8} className="h-[22px] w-[22px] items-center justify-center rounded-full bg-[#ff6b6b1f]">
                    <Ionicons name="close" size={14} color="#FF6B6B" />
                </Pressable>
            </View>
        </Animated.View>
    );
}
