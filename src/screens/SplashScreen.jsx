import { FontAwesome5 } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import {
    Animated,
    Easing,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function SplashScreen({ navigation }) {
    const { user, loading } = useAuth();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const translateAnim = useRef(new Animated.Value(24)).current;
    const scaleAnim = useRef(new Animated.Value(0.88)).current;
    const orbitAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const introAnimation = Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 900,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(translateAnim, {
                toValue: 0,
                duration: 900,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
                toValue: 1,
                duration: 900,
                easing: Easing.out(Easing.back(1.2)),
                useNativeDriver: true,
            }),
        ]);

        const orbitLoop = Animated.loop(
            Animated.timing(orbitAnim, {
                toValue: 1,
                duration: 6000,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        );

        const pulseLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.06,
                    duration: 1600,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1600,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        );

        introAnimation.start();
        orbitLoop.start();
        pulseLoop.start();

        return () => {
            orbitLoop.stop();
            pulseLoop.stop();
        };
    }, [fadeAnim, orbitAnim, pulseAnim, scaleAnim, translateAnim]);

    useEffect(() => {
        if (loading) {
            return undefined;
        }

        const timer = setTimeout(() => {
            navigation.replace(user ? 'MainTabs' : 'Login');
        }, 1500);

        return () => {
            clearTimeout(timer);
        };
    }, [loading, navigation, user]);

    const orbitSpin = orbitAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <View className="flex-1 justify-between bg-[#111111] px-6 pt-24 pb-[72px]" style={Platform.OS === 'web' ? styles.webSplash : undefined}>
            <StatusBar barStyle="light-content" />

            <View className="absolute right-[-30px] top-20 h-[220px] w-[220px] rounded-full bg-[#f59e0b29]" />
            <View className="absolute bottom-[130px] left-[-40px] h-[240px] w-[240px] rounded-full bg-[#22c55e1f]" />

            <Animated.View
                className="flex-1 items-center justify-center"
                style={{
                    opacity: fadeAnim,
                    transform: [{ translateY: translateAnim }],
                }}
            >
                <Animated.View
                    className="mb-[34px] h-[164px] w-[164px] items-center justify-center"
                    style={{
                        transform: [{ scale: scaleAnim }, { scale: pulseAnim }],
                    }}
                >
                    <Animated.View
                        className="absolute h-[164px] w-[164px] rounded-full border border-white/10"
                        style={{ transform: [{ rotate: orbitSpin }] }}
                    >
                        <View className="absolute left-1/2 top-2.5 ml-[-7px] h-[14px] w-[14px] rounded-full bg-[#F59E0B]" />
                        <View className="absolute bottom-6 left-[18px] h-2.5 w-2.5 rounded-full bg-[#22C55E]" />
                    </Animated.View>

                    <View
                        className="h-[118px] w-[118px] items-center justify-center rounded-[32px] border border-white/10 bg-[#1F1F1F]"
                        style={{
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 18 },
                            shadowOpacity: 0.28,
                            shadowRadius: 24,
                            elevation: 10,
                        }}
                    >
                        <FontAwesome5 name="utensils" size={34} color="#FFF7ED" />
                    </View>
                </Animated.View>

                <Text className="mb-3 text-[34px] font-extrabold tracking-[0.8px] text-white">CookSmart</Text>
                <Text className="max-w-[270px] text-center text-[15px] leading-6 text-white/70">
                    Plan smarter, cook cleaner, eat better.
                </Text>
            </Animated.View>

            <Animated.View className="items-center" style={{ opacity: fadeAnim }}>
                <View className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <Animated.View
                        className="h-full flex-1 rounded-full bg-[#F59E0B]"
                        style={{ transform: [{ scaleX: fadeAnim }] }}
                    />
                </View>
                <Text className="text-[13px] tracking-[0.4px] text-white/60">Preparing your kitchen companion</Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    webSplash: {
        width: '100%',
        maxWidth: 398,
        alignSelf: 'center',
    },
});
