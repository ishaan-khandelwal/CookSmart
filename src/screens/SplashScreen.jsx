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
            navigation.replace(user ? 'MainTabs' : 'Landing');
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
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            <View style={styles.orbTop} />
            <View style={styles.orbBottom} />

            <Animated.View
                style={[
                    styles.heroBlock,
                    {
                        opacity: fadeAnim,
                        transform: [{ translateY: translateAnim }],
                    },
                ]}
            >
                <Animated.View
                    style={[
                        styles.logoOrbitWrap,
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
                        <View style={styles.orbitDotSecondary} />
                    </Animated.View>

                    <View style={styles.logoCard}>
                        <FontAwesome5 name="utensils" size={34} color="#FFF7ED" />
                    </View>
                </Animated.View>

                <Text style={styles.title}>CookSmart</Text>
                <Text style={styles.subtitle}>
                    Plan smarter, cook cleaner, eat better.
                </Text>
            </Animated.View>

            <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
                <View style={styles.progressTrack}>
                    <Animated.View
                        style={[
                            styles.progressFill,
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
        justifyContent: 'space-between',
        backgroundColor: '#111111',
        paddingHorizontal: 24,
        paddingTop: 96,
        paddingBottom: 72,
    },
    orbTop: {
        position: 'absolute',
        right: -30,
        top: 80,
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: '#f59e0b29',
    },
    orbBottom: {
        position: 'absolute',
        bottom: 130,
        left: -40,
        width: 240,
        height: 240,
        borderRadius: 120,
        backgroundColor: '#22c55e1f',
    },
    heroBlock: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoOrbitWrap: {
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
        borderColor: 'rgba(255,255,255,0.10)',
    },
    orbitDotPrimary: {
        position: 'absolute',
        left: '50%',
        top: 10,
        marginLeft: -7,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#F59E0B',
    },
    orbitDotSecondary: {
        position: 'absolute',
        bottom: 24,
        left: 18,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#22C55E',
    },
    logoCard: {
        width: 118,
        height: 118,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 32,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.10)',
        backgroundColor: '#1F1F1F',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.28,
        shadowRadius: 24,
        elevation: 10,
    },
    title: {
        marginBottom: 12,
        fontSize: 34,
        fontWeight: '800',
        letterSpacing: 0.8,
        color: '#FFFFFF',
    },
    subtitle: {
        maxWidth: 270,
        textAlign: 'center',
        fontSize: 15,
        lineHeight: 24,
        color: 'rgba(255,255,255,0.70)',
    },
    footer: {
        alignItems: 'center',
    },
    progressTrack: {
        width: '100%',
        height: 6,
        marginBottom: 16,
        overflow: 'hidden',
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.10)',
    },
    progressFill: {
        flex: 1,
        borderRadius: 999,
        backgroundColor: '#F59E0B',
    },
    footerText: {
        fontSize: 13,
        letterSpacing: 0.4,
        color: 'rgba(255,255,255,0.60)',
    },
});
