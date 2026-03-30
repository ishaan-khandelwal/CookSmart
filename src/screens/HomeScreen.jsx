import { Feather, FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, Pressable, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BOTTOM_TAB_BAR_RESERVED_SPACE } from '../components/BottomTabBar';
import { useAuth } from '../context/AuthContext';
import { fetchFavorites, fetchHistory } from '../services/api';

const RECENT_SCAN_KEY = 'cooksmart:lastScan';

const quickActions = [
    { id: 'scan', title: 'Scan ingredients', subtitle: 'Snap your pantry and produce.', icon: 'camera', accent: '#F59E0B', bg: '#1D1508', screen: 'Scan' },
    { id: 'recipes', title: 'Saved recipes', subtitle: 'Jump back into dishes you trust.', icon: 'heart', accent: '#22C55E', bg: '#0D1B12', screen: 'Recipes' },
    { id: 'planner', title: 'Meal planner', subtitle: 'Map the next few meals quickly.', icon: 'calendar', accent: '#60A5FA', bg: '#0B1726', screen: 'Planner' },
];

const menuIdeas = [
    { id: 'pasta', eyebrow: 'Weeknight rescue', title: 'Lemon garlic pasta', tone: '#F59E0B', bg: '#22160A', image: require('../../assets/images/pasta_hero.png') },
    { id: 'bowl', eyebrow: 'Fresh reset', title: 'Crunch bowl with herbs', tone: '#22C55E', bg: '#102015', image: require('../../assets/images/crunch_bowl.png') },
];

function getDayPart() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Morning';
    if (hour < 18) return 'Afternoon';
    return 'Evening';
}

function formatDateLabel() {
    return new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });
}

function formatLastScanLabel(scannedAt) {
    if (!scannedAt) return 'No recent scan yet';
    const date = new Date(scannedAt);
    if (Number.isNaN(date.getTime())) return 'No recent scan yet';
    return `Last scan ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

function InteractiveCard({ children, onPress, className = '', containerStyle = {} }) {
    const scale = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();
    };

    return (
        <Animated.View style={[{ transform: [{ scale }] }, containerStyle]}>
            <Pressable
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={onPress}
                className={className}
            >
                {children}
            </Pressable>
        </Animated.View>
    );
}

export default function HomeScreen({ navigation }) {
    const { user } = useAuth();
    const { width, height } = useWindowDimensions();
    const [recentScan, setRecentScan] = useState({ ingredients: [], photoUri: null, scannedAt: null });
    const [favoritesCount, setFavoritesCount] = useState(0);
    const [historyCount, setHistoryCount] = useState(0);

    const intro = useRef(new Animated.Value(0)).current;
    const floatAnim = useRef(new Animated.Value(0)).current;
    const scrollY = useRef(new Animated.Value(0)).current;

    const firstName = useMemo(() => {
        const name = user?.displayName ? user.displayName.split(' ')[0] : 'Chef';
        return name.charAt(0).toUpperCase() + name.slice(1);
    }, [user]);
    const isWebPhone = Platform.OS === 'web';
    const isCompact = width < 390 || (isWebPhone && width < 460) || height < 780;

    const dayPart = useMemo(() => getDayPart(), []);
    const dateLabel = useMemo(() => formatDateLabel(), []);
    const syncLabel = user?.uid && process.env.EXPO_PUBLIC_API_URL ? 'Cloud Kitchen Active' : 'Offline Local Mode';

    const pantryReadiness = useMemo(() => {
        const base = recentScan.ingredients.length ? 34 : 16;
        return Math.min(98, base + recentScan.ingredients.length * 9 + favoritesCount * 3);
    }, [favoritesCount, recentScan.ingredients.length]);

    const stats = useMemo(
        () => [
            { id: 'saved', value: favoritesCount, label: 'Favorites', accent: '#22C55E' },
            { id: 'scan', value: recentScan.ingredients.length, label: 'Scanned', accent: '#F59E0B' },
            { id: 'history', value: historyCount, label: 'Sessions', accent: '#60A5FA' },
        ],
        [favoritesCount, historyCount, recentScan.ingredients.length],
    );

    const loadHomeState = useCallback(async () => {
        try {
            const savedScan = await AsyncStorage.getItem(RECENT_SCAN_KEY);
            if (savedScan) {
                const parsedScan = JSON.parse(savedScan);
                setRecentScan({
                    ingredients: Array.isArray(parsedScan.ingredients) ? parsedScan.ingredients.slice(0, 6) : [],
                    photoUri: parsedScan.photoUri || null,
                    scannedAt: parsedScan.scannedAt || null,
                });
            } else {
                setRecentScan({ ingredients: [], photoUri: null, scannedAt: null });
            }
        } catch {
            setRecentScan({ ingredients: [], photoUri: null, scannedAt: null });
        }

        if (!user?.uid || !process.env.EXPO_PUBLIC_API_URL) {
            setFavoritesCount(0);
            setHistoryCount(0);
            return;
        }

        const [favoritesResult, historyResult] = await Promise.allSettled([
            fetchFavorites(user.uid),
            fetchHistory(user.uid),
        ]);

        setFavoritesCount(favoritesResult.status === 'fulfilled' && Array.isArray(favoritesResult.value) ? favoritesResult.value.length : 0);
        setHistoryCount(historyResult.status === 'fulfilled' && Array.isArray(historyResult.value) ? historyResult.value.length : 0);
    }, [user?.uid]);

    useFocusEffect(
        useCallback(() => {
            loadHomeState();
        }, [loadHomeState]),
    );

    useEffect(() => {
        const introAnimation = Animated.timing(intro, {
            toValue: 1,
            duration: 800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        });

        const floatingAnimation = Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim, {
                    toValue: 1,
                    duration: 4000,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(floatAnim, {
                    toValue: 0,
                    duration: 4000,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
            ]),
        );

        introAnimation.start();
        floatingAnimation.start();

        return () => {
            floatingAnimation.stop();
        };
    }, [floatAnim, intro]);

    const drift = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -20] });
    const heroShift = scrollY.interpolate({ inputRange: [-150, 0, 250], outputRange: [-24, 0, 40], extrapolate: 'clamp' });
    const heroScale = scrollY.interpolate({ inputRange: [-150, 0, 250], outputRange: [1.05, 1, 0.95], extrapolate: 'clamp' });
    const introOpacity = intro.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
    const introLift = intro.interpolate({ inputRange: [0, 1], outputRange: [32, 0] });

    const openRecentScan = useCallback(() => {
        if (!recentScan.ingredients.length) {
            navigation.navigate('Scan');
            return;
        }
        const rootNavigation = navigation.getParent() ?? navigation;
        rootNavigation.navigate('IngredientsResult', {
            ingredients: recentScan.ingredients,
            photoUri: recentScan.photoUri,
        });
    }, [navigation, recentScan.ingredients, recentScan.photoUri]);

    return (
        <View style={styles.screen}>
            <StatusBar barStyle="light-content" />
            <Animated.View pointerEvents="none" style={[styles.orbTop, { transform: [{ translateY: drift }] }]} />
            <Animated.View pointerEvents="none" style={[styles.orbLeft, { transform: [{ translateY: heroShift }] }]} />
            <Animated.View pointerEvents="none" style={styles.orbBottom} />

            <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
                <Animated.ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[styles.scrollContent, isWebPhone && styles.webScrollContent]}
                    scrollEventThrottle={16}
                    onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
                >
                    <View style={[styles.pagePadding, isWebPhone && styles.webPagePadding]}>
                        <Animated.View style={{ opacity: introOpacity, transform: [{ translateY: introLift }, { translateY: heroShift }, { scale: heroScale }] }}>
                            <View style={[styles.hero, isCompact && styles.heroCompact]}>
                                <View style={styles.heroGlowA} />
                                <View style={styles.heroGlowB} />

                                <View className="mb-8 flex-row items-center justify-between">
                                    <View className="flex-1 pr-4">
                                        <Text className="text-[12px] font-extrabold uppercase tracking-[2px] text-[#F8B84E]">Kitchen Intelligence</Text>
                                        <Text
                                            className={`${isCompact ? 'text-[30px]' : 'text-[34px]'} mt-2 font-black text-white`}
                                            numberOfLines={1}
                                            adjustsFontSizeToFit
                                            minimumFontScale={0.82}
                                        >
                                            {dayPart}, {firstName}
                                        </Text>
                                        <Text className="mt-1.5 text-[14px] font-medium text-white/70">{dateLabel}</Text>

                                    </View>
                                    <View className={`${isCompact ? 'h-12 w-12' : 'h-14 w-14'} items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-lg`}>
                                        <Text className="text-xl font-black uppercase text-white">{firstName.slice(0, 1)}</Text>
                                    </View>
                                </View>

                                <View className={isCompact ? '' : 'max-w-[260px]'}>
                                    <View className="mb-5 flex-row items-center self-start rounded-full border border-white/10 bg-[#00000044] px-4 py-2">
                                        <FontAwesome5 name="utensils" size={12} color="#F8B84E" />
                                        <Text className="ml-2 text-[11px] font-extrabold uppercase tracking-[1px] text-white/90">{syncLabel}</Text>
                                    </View>
                                    <Text className={`${isCompact ? 'text-[34px] leading-[40px]' : 'text-[40px] leading-[46px]'} font-black tracking-tight text-white`}>
                                        Smart cooking, less noise.
                                    </Text>
                                    <Text className="mt-5 text-[16px] leading-7 text-white/80">
                                        Transform your pantry ingredients into chef-driven meal plans in seconds.
                                    </Text>
                                </View>

                                <View className={`mt-8 gap-4 ${isCompact ? '' : 'flex-row'}`}>
                                    <InteractiveCard
                                        containerStyle={{ flex: isCompact ? 0 : 1 }}
                                        className="flex-row items-center justify-center rounded-[20px] bg-[#F59E0B] px-5 py-5 shadow-xl shadow-[#F59E0B]/30"
                                        onPress={() => navigation.navigate('Scan')}
                                    >
                                        <Feather name="camera" size={20} color="#111111" />
                                        <Text className="ml-2.5 text-[15px] font-black uppercase text-[#111111]">Scan Pantry</Text>
                                    </InteractiveCard>
                                    <InteractiveCard
                                        className="flex-row items-center justify-center rounded-[20px] border border-white/20 bg-white/10 px-5 py-5"
                                        onPress={() => navigation.navigate('Recipes')}
                                    >
                                        <Feather name="heart" size={20} color="#FFFFFF" />
                                        <Text className="ml-2.5 text-[15px] font-bold text-white">Saved</Text>
                                    </InteractiveCard>
                                </View>

                                {isCompact ? (
                                    <View className="mt-5 gap-3">
                                        <Animated.View
                                            style={[
                                                styles.heroBadgeCompact,
                                                { transform: [{ translateY: drift }] },
                                            ]}
                                        >
                                            <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-white/60">Readiness</Text>
                                            <Text className="mt-2 text-[28px] font-black text-white">{pantryReadiness}%</Text>
                                            <Text className="mt-1.5 text-[12px] leading-5 text-white/70">Based on your recent ingredients and history.</Text>
                                        </Animated.View>
                                        <View style={styles.heroPillCompact}>
                                            <Text className="text-[11px] font-black uppercase tracking-[1px] text-[#111111]">Session Status</Text>
                                            <Text className="mt-1 text-[13px] font-bold text-[#111111]">{dayPart === 'Evening' ? 'Dinner Rush' : 'Lunch Prep'}</Text>
                                        </View>
                                    </View>
                                ) : (
                                    <>
                                        <Animated.View style={[styles.heroBadge, { transform: [{ translateY: drift }] }]}>
                                            <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-white/60">Readiness</Text>
                                            <Text className="mt-2 text-[30px] font-black text-white">{pantryReadiness}%</Text>
                                            <Text className="mt-1.5 text-[12px] leading-5 text-white/70">Based on your recent ingredients and history.</Text>
                                        </Animated.View>

                                        <View style={styles.heroPill}>
                                            <Text className="text-[11px] font-black uppercase tracking-[1px] text-[#111111]">Session Status</Text>
                                            <Text className="mt-1 text-[13px] font-bold text-[#111111]">{dayPart === 'Evening' ? 'Dinner Rush' : 'Lunch Prep'}</Text>
                                        </View>
                                    </>
                                )}
                            </View>
                        </Animated.View>

                        <Animated.View style={{ opacity: introOpacity, transform: [{ translateY: introLift }] }}>
                            <View className="mt-8">
                                <View className={`mb-5 ${isCompact ? 'gap-3' : 'flex-row items-end justify-between'}`}>
                                    <View>
                                        <Text className="text-[26px] font-black text-white">Kitchen Pulse</Text>
                                        <Text className="mt-1.5 text-[14px] font-medium text-white/50">Your active inventory at a glance.</Text>
                                    </View>
                                    <View className="self-start rounded-full border border-white/10 bg-white/5 px-4 py-2">
                                        <Text className="text-[11px] font-bold uppercase tracking-[1px] text-white/80">{formatLastScanLabel(recentScan.scannedAt)}</Text>
                                    </View>
                                </View>

                                <View className={`gap-4 ${isCompact ? '' : 'flex-row'}`}>
                                    {stats.map((item) => (
                                        <View key={item.id} className="flex-1 rounded-[26px] border border-white/10 bg-[#151515]/80 p-5 shadow-sm">
                                            <View className="h-1.5 w-10 rounded-full" style={{ backgroundColor: item.accent }} />
                                            <Text className="mt-5 text-[30px] font-black text-white">{item.value}</Text>
                                            <Text className="mt-1 text-[13px] font-semibold text-white/50 uppercase tracking-[1px]">{item.label}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>

                            <View className="mt-10">
                                <Text className="text-[26px] font-black text-white">Quick Nav</Text>
                                <Text className="mt-1.5 text-[14px] font-medium text-white/50">The fastest paths to your next dish.</Text>
                                <View className={`mt-5 gap-4 ${isCompact ? '' : 'flex-row'}`}>
                                    <InteractiveCard
                                        className="rounded-[32px] px-6 py-8"
                                        onPress={() => navigation.navigate(quickActions[0].screen)}
                                        containerStyle={{ backgroundColor: quickActions[0].bg, borderRadius: 32, flex: isCompact ? 0 : 1 }}
                                    >
                                        <View className="h-16 w-16 items-center justify-center rounded-[22px]" style={{ backgroundColor: quickActions[0].accent }}>
                                            <Feather name={quickActions[0].icon} size={26} color="#111111" />
                                        </View>
                                        <Text className="mt-8 text-[24px] font-black text-white">{quickActions[0].title}</Text>
                                        <Text className="mt-3 text-[15px] leading-6 text-white/80">{quickActions[0].subtitle}</Text>
                                    </InteractiveCard>

                                    <View className={isCompact ? 'gap-4' : 'w-[44%] gap-4'}>
                                        {quickActions.slice(1).map((action) => (
                                            <InteractiveCard
                                                key={action.id}
                                                className="rounded-[28px] px-5 py-6"
                                                onPress={() => navigation.navigate(action.screen)}
                                                containerStyle={{ backgroundColor: action.bg, borderRadius: 28 }}
                                            >
                                                <View className="h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: `${action.accent}33`, borderWidth: 1, borderColor: `${action.accent}66` }}>
                                                    <Feather name={action.icon} size={20} color={action.accent} />
                                                </View>
                                                <Text className="mt-6 text-[17px] font-black text-white">{action.title}</Text>
                                                <Text className="mt-1.5 text-[12px] font-medium leading-5 text-white/60">{action.subtitle}</Text>
                                            </InteractiveCard>
                                        ))}
                                    </View>
                                </View>
                            </View>

                            <InteractiveCard
                                className="mt-10 overflow-hidden rounded-[34px] border border-white/10 bg-[#121F2D] px-6 py-8"
                                onPress={openRecentScan}
                            >
                                <View style={styles.scanGlow} />
                                <View className="flex-row items-start justify-between">
                                    <View className="flex-1 pr-6">
                                        <Text className="text-[12px] font-extrabold uppercase tracking-[2px] text-[#F8B84E]">Active Session</Text>
                                        <Text className="mt-4 text-[28px] font-black leading-9 text-white">
                                            {recentScan.ingredients.length ? 'Continue with your latest pantry scan.' : 'Launch ingredient scanner.'}
                                        </Text>
                                        <Text className="mt-4 text-[15px] leading-7 text-white/80">
                                            {recentScan.ingredients.length
                                                ? 'Your latest search parameters are still active. Tap to jump back into results.'
                                                : 'Point the camera at your fridge or dry goods to get instant meal suggestions.'}
                                        </Text>
                                    </View>
                                    <View className="rounded-full border border-white/20 bg-white/10 px-4 py-2.5">
                                        <Text className="text-[12px] font-black text-white">{recentScan.ingredients.length ? `${recentScan.ingredients.length} Items` : 'Ready'}</Text>
                                    </View>
                                </View>

                                <View className="mt-7 flex-row flex-wrap">
                                    {(recentScan.ingredients.length ? recentScan.ingredients : ['Basil', 'Garlic', 'Chili']).map((ingredient) => (
                                        <View key={ingredient} className="mb-2.5 mr-2.5 rounded-full border border-white/10 bg-white/10 px-4 py-2.5">
                                            <Text className="text-[14px] font-bold capitalize text-white">{ingredient}</Text>
                                        </View>
                                    ))}
                                </View>
                            </InteractiveCard>

                            <View className="mt-10 gap-5">
                                <Text className="text-[26px] font-black text-white">Meal Inspiration</Text>
                                {menuIdeas.map((item) => (
                                    <InteractiveCard
                                        key={item.id}
                                        className="overflow-hidden rounded-[30px]"
                                        onPress={() => { }}
                                        containerStyle={{ backgroundColor: item.bg, borderRadius: 30 }}
                                    >
                                        <Image source={item.image} className={`${isCompact ? 'h-[176px]' : 'h-[220px]'} w-full`} resizeMode="cover" />
                                        <View className="absolute inset-x-0 bottom-0 bg-black/40 px-6 py-6 border-t border-white/5">
                                            <View className="flex-row items-center justify-between">
                                                <Text className="text-[11px] font-black uppercase tracking-[2px]" style={{ color: item.tone }}>{item.eyebrow}</Text>
                                                <View className="h-1.5 w-12 rounded-full" style={{ backgroundColor: item.tone }} />
                                            </View>
                                            <Text className="mt-3 text-[26px] font-black text-white">{item.title}</Text>
                                        </View>
                                    </InteractiveCard>
                                ))}
                            </View>
                        </Animated.View>
                    </View>
                </Animated.ScrollView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#050A10' },
    scrollContent: { paddingBottom: BOTTOM_TAB_BAR_RESERVED_SPACE + 24 },
    pagePadding: { paddingHorizontal: 22 },
    webScrollContent: { paddingTop: 8, paddingBottom: BOTTOM_TAB_BAR_RESERVED_SPACE + 42 },
    webPagePadding: { paddingTop: 4 },

    orbTop: { position: 'absolute', top: -100, right: -80, width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(245, 158, 11, 0.16)' },

    orbLeft: { position: 'absolute', top: 300, left: -100, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(34, 197, 94, 0.14)' },

    orbBottom: { position: 'absolute', bottom: 180, right: -40, width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(96, 165, 250, 0.12)' },

    hero: { overflow: 'hidden', borderRadius: 38, minHeight: 520, padding: 26, backgroundColor: '#101B28', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    heroCompact: { minHeight: 0 },

    heroGlowA: { position: 'absolute', top: -70, right: -60, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(245, 158, 11, 0.22)' },

    heroGlowB: { position: 'absolute', bottom: -100, left: -80, width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(34, 197, 94, 0.18)' },

    heroBadge: { position: 'absolute', right: 20, top: 180, width: 156, borderRadius: 24, padding: 16, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },

    heroPill: { position: 'absolute', right: 26, bottom: 30, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 14, backgroundColor: '#F8B84E', shadowColor: '#F8B84E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },

    heroBadgeCompact: { borderRadius: 24, padding: 16, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },

    heroPillCompact: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 14, backgroundColor: '#F8B84E', shadowColor: '#F8B84E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },

    scanGlow: { position: 'absolute', top: -60, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(248, 184, 78, 0.14)' },
});
