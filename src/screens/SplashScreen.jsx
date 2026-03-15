import { FontAwesome5 } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import {
    Animated,
    Easing,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';

export default function SplashScreen({ navigation }) {
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

        const timer = setTimeout(() => {
            navigation.replace('Login');
        }, 2400);

        return () => {
            clearTimeout(timer);
            orbitLoop.stop();
            pulseLoop.stop();
        };
    }, [fadeAnim, navigation, orbitAnim, pulseAnim, scaleAnim, translateAnim]);

    const orbitSpin = orbitAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            <View style={styles.backgroundGlowTop} />
            <View style={styles.backgroundGlowBottom} />

            <Animated.View
                style={[
                    styles.heroSection,
                    {
                        opacity: fadeAnim,
                        transform: [{ translateY: translateAnim }],
                    },
                ]}
            >
                <Animated.View
                    style={[
                        styles.brandShell,
                        {
                            transform: [{ scale: scaleAnim }, { scale: pulseAnim }],
                        },
                    ]}
                >
                    <Animated.View
                        style={[
                            styles.orbitRing,
                            { transform: [{ rotate: orbitSpin }] },
                        ]}
                    >
                        <View style={styles.orbitDotPrimary} />
                        <View style={styles.orbitDotAccent} />
                    </Animated.View>

                    <View style={styles.brandBadge}>
                        <FontAwesome5 name="utensils" size={34} color="#FFF7ED" />
                    </View>
                </Animated.View>

                <Text style={styles.title}>CookSmart</Text>
                <Text style={styles.subtitle}>Plan smarter, cook cleaner, eat better.</Text>
            </Animated.View>

            <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
                <View style={styles.loadingTrack}>
                    <Animated.View
                        style={[
                            styles.loadingFill,
                            {
                                transform: [{ scaleX: fadeAnim }],
                            },
                        ]}
                    />
                </View>
                <Text style={styles.footerText}>Preparing your kitchen companion</Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111111',
        paddingHorizontal: 24,
        justifyContent: 'space-between',
        paddingTop: 96,
        paddingBottom: 72,
    },
    backgroundGlowTop: {
        position: 'absolute',
        top: 80,
        right: -30,
        width: 220,
        height: 220,
        borderRadius: 999,
        backgroundColor: 'rgba(245, 158, 11, 0.16)',
    },
    backgroundGlowBottom: {
        position: 'absolute',
        bottom: 130,
        left: -40,
        width: 240,
        height: 240,
        borderRadius: 999,
        backgroundColor: 'rgba(34, 197, 94, 0.12)',
    },
    heroSection: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    brandShell: {
        width: 164,
        height: 164,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 34,
    },
    orbitRing: {
        position: 'absolute',
        width: 164,
        height: 164,
        borderRadius: 82,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.10)',
    },
    orbitDotPrimary: {
        position: 'absolute',
        top: 10,
        left: '50%',
        marginLeft: -7,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#F59E0B',
    },
    orbitDotAccent: {
        position: 'absolute',
        bottom: 24,
        left: 18,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#22C55E',
    },
    brandBadge: {
        width: 118,
        height: 118,
        borderRadius: 32,
        backgroundColor: '#1F1F1F',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.28,
        shadowRadius: 24,
        elevation: 10,
    },
    title: {
        fontSize: 34,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: 0.8,
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 15,
        lineHeight: 24,
        color: 'rgba(255, 255, 255, 0.72)',
        textAlign: 'center',
        maxWidth: 270,
    },
    footer: {
        alignItems: 'center',
    },
    loadingTrack: {
        width: '100%',
        height: 6,
        borderRadius: 999,
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.10)',
        marginBottom: 16,
    },
    loadingFill: {
        flex: 1,
        borderRadius: 999,
        backgroundColor: '#F59E0B',
    },
    footerText: {
        fontSize: 13,
        letterSpacing: 0.4,
        color: 'rgba(255, 255, 255, 0.58)',
    },
});
