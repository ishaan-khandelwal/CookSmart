import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { fetchFavorites, fetchHistory } from '../services/api';

const RECENT_SCAN_KEY = 'cooksmart:lastScan';

const quickActions = [
    { id: 'scan', title: 'Scan ingredients', subtitle: 'Snap your pantry and produce.', icon: 'camera', accent: '#F59E0B', bg: '#1D1508', screen: 'Scan' },
    { id: 'recipes', title: 'Saved recipes', subtitle: 'Jump back into dishes you trust.', icon: 'heart', accent: '#22C55E', bg: '#0D1B12', screen: 'Recipes' },
    { id: 'planner', title: 'Meal planner', subtitle: 'Map the next few meals quickly.', icon: 'calendar', accent: '#60A5FA', bg: '#0B1726', screen: 'Planner' },
];

const menuIdeas = [
    { id: 'pasta', eyebrow: 'Weeknight rescue', title: 'Lemon garlic pasta', tone: '#F59E0B', bg: '#22160A' },
    { id: 'bowl', eyebrow: 'Fresh reset', title: 'Crunch bowl with herbs', tone: '#22C55E', bg: '#102015' },
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

export default function HomeScreen({ navigation }) {
    const { user } = useAuth();
    const [recentScan, setRecentScan] = useState({ ingredients: [], photoUri: null, scannedAt: null });
    const [favoritesCount, setFavoritesCount] = useState(0);
    const [historyCount, setHistoryCount] = useState(0);

    const intro = useRef(new Animated.Value(0)).current;
    const floatAnim = useRef(new Animated.Value(0)).current;
    const scrollY = useRef(new Animated.Value(0)).current;

    const firstName = useMemo(() => (user?.displayName ? user.displayName.split(' ')[0] : 'Chef'), [user]);
    const dayPart = useMemo(() => getDayPart(), []);
    const dateLabel = useMemo(() => formatDateLabel(), []);
    const syncLabel = user?.uid && process.env.EXPO_PUBLIC_API_URL ? 'Cloud sync ready' : 'Local kitchen mode';

    const pantryReadiness = useMemo(() => {
        const base = recentScan.ingredients.length ? 34 : 16;
        return Math.min(98, base + recentScan.ingredients.length * 9 + favoritesCount * 3);
    }, [favoritesCount, recentScan.ingredients.length]);

    const stats = useMemo(
        () => [
            { id: 'saved', value: favoritesCount, label: 'Saved', accent: '#22C55E' },
            { id: 'scan', value: recentScan.ingredients.length, label: 'Recent', accent: '#F59E0B' },
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
            duration: 650,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        });

        const floatingAnimation = Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim, {
                    toValue: 1,
                    duration: 3500,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(floatAnim, {
                    toValue: 0,
                    duration: 3500,
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

    const drift = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });
    const heroShift = scrollY.interpolate({ inputRange: [-120, 0, 220], outputRange: [-18, 0, 30], extrapolate: 'clamp' });
    const heroScale = scrollY.interpolate({ inputRange: [-120, 0, 220], outputRange: [1.03, 1, 0.98], extrapolate: 'clamp' });
    const introOpacity = intro.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
    const introLift = intro.interpolate({ inputRange: [0, 1], outputRange: [26, 0] });

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
                    contentContainerStyle={styles.scrollContent}
                    scrollEventThrottle={16}
                    onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
                >
                    <View style={styles.pagePadding}>
                        <Animated.View style={{ opacity: introOpacity, transform: [{ translateY: introLift }, { translateY: heroShift }, { scale: heroScale }] }}>
                            <View style={styles.hero}>
                                <View style={styles.heroGlowA} />
                                <View style={styles.heroGlowB} />

                                <View className="mb-6 flex-row items-center justify-between">
                                    <View>
                                        <Text className="text-[12px] font-extrabold uppercase tracking-[1.6px] text-[#F8B84E]">CookSmart</Text>
                                        <Text className="mt-2 text-[32px] font-extrabold text-white">{dayPart}, {firstName}</Text>
                                        <Text className="mt-2 text-[13px] text-white/60">{dateLabel}</Text>
                                    </View>
                                    <View className="h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5">
                                        <Text className="text-lg font-black uppercase text-white">{firstName.slice(0, 1)}</Text>
                                    </View>
                                </View>

                                <View className="max-w-[245px]">
                                    <View className="mb-4 flex-row items-center self-start rounded-full border border-white/10 bg-white/8 px-3 py-2">
                                        <FontAwesome5 name="utensils" size={14} color="#F8B84E" />
                                        <Text className="ml-2 text-[12px] font-bold text-white/80">{syncLabel}</Text>
                                    </View>
                                    <Text className="text-[38px] font-black leading-[44px] text-white">Turn pantry chaos into tonight&apos;s plan.</Text>
                                    <Text className="mt-4 text-[15px] leading-6 text-white/70">
                                        Scan what you have, keep strong ideas close, and move from ingredients to dinner with less friction.
                                    </Text>
                                </View>

                                <View className="mt-7 flex-row gap-3">
                                    <Pressable className="flex-1 flex-row items-center justify-center rounded-[18px] bg-[#F59E0B] px-4 py-4" onPress={() => navigation.navigate('Scan')}>
                                        <Feather name="camera" size={18} color="#111111" />
                                        <Text className="ml-2 text-[14px] font-extrabold text-[#111111]">Start scanning</Text>
                                    </Pressable>
                                    <Pressable className="flex-row items-center justify-center rounded-[18px] border border-white/10 bg-white/6 px-4 py-4" onPress={() => navigation.navigate('Recipes')}>
                                        <Feather name="heart" size={18} color="#FFFFFF" />
                                        <Text className="ml-2 text-[14px] font-bold text-white">Saved</Text>
                                    </Pressable>
                                </View>

                                <Animated.View style={[styles.heroBadge, { transform: [{ translateY: drift }] }]}>
                                    <Text className="text-[12px] font-bold uppercase tracking-[1px] text-white/55">Pantry readiness</Text>
                                    <Text className="mt-2 text-[26px] font-black text-white">{pantryReadiness}%</Text>
                                    <Text className="mt-1 text-[13px] leading-5 text-white/60">Driven by recent scans and your saved recipe count.</Text>
                                </Animated.View>

                                <View style={styles.heroPill}>
                                    <Text className="text-[12px] font-bold uppercase tracking-[1px] text-[#111111]">Dinner window</Text>
                                    <Text className="mt-1 text-[13px] font-extrabold text-[#111111]">{dayPart === 'Evening' ? 'Dinner rush ready' : dayPart === 'Afternoon' ? 'Build lunch fast' : 'Prep early'}</Text>
                                </View>
                            </View>
                        </Animated.View>

                        <Animated.View style={{ opacity: introOpacity, transform: [{ translateY: introLift }] }}>
                            <View className="mt-7">
                                <View className="mb-4 flex-row items-end justify-between">
                                    <View>
                                        <Text className="text-[24px] font-black text-white">Kitchen pulse</Text>
                                        <Text className="mt-1 text-[14px] text-white/55">A live snapshot of what is ready right now.</Text>
                                    </View>
                                    <View className="rounded-full border border-white/10 bg-white/5 px-3 py-2">
                                        <Text className="text-[12px] font-bold uppercase tracking-[1px] text-white/60">{formatLastScanLabel(recentScan.scannedAt)}</Text>
                                    </View>
                                </View>

                                <View className="flex-row gap-3">
                                    {stats.map((item) => (
                                        <View key={item.id} className="flex-1 rounded-[22px] border border-white/8 bg-white/5 p-4">
                                            <View className="h-2.5 w-10 rounded-full" style={{ backgroundColor: item.accent }} />
                                            <Text className="mt-4 text-[28px] font-black text-white">{item.value}</Text>
                                            <Text className="mt-1 text-[13px] text-white/58">{item.label}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>

                            <View className="mt-7">
                                <Text className="text-[24px] font-black text-white">Jump back in</Text>
                                <Text className="mt-1 text-[14px] text-white/55">The fastest routes through the app.</Text>
                                <View className="mt-4 flex-row gap-3">
                                    <Pressable className="flex-1 rounded-[28px] px-5 py-6" style={{ backgroundColor: quickActions[0].bg }} onPress={() => navigation.navigate(quickActions[0].screen)}>
                                        <View className="h-14 w-14 items-center justify-center rounded-[18px]" style={{ backgroundColor: quickActions[0].accent }}>
                                            <Feather name={quickActions[0].icon} size={22} color="#111111" />
                                        </View>
                                        <Text className="mt-6 text-[22px] font-black text-white">{quickActions[0].title}</Text>
                                        <Text className="mt-2 text-[14px] leading-6 text-white/65">{quickActions[0].subtitle}</Text>
                                    </Pressable>

                                    <View className="w-[42%] gap-3">
                                        {quickActions.slice(1).map((action) => (
                                            <Pressable key={action.id} className="rounded-[24px] px-4 py-5" style={{ backgroundColor: action.bg }} onPress={() => navigation.navigate(action.screen)}>
                                                <View className="h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: `${action.accent}22`, borderWidth: 1, borderColor: `${action.accent}44` }}>
                                                    <Feather name={action.icon} size={18} color={action.accent} />
                                                </View>
                                                <Text className="mt-4 text-[16px] font-bold text-white">{action.title}</Text>
                                                <Text className="mt-1 text-[12px] leading-5 text-white/55">{action.subtitle}</Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                </View>
                            </View>

                            <Pressable className="mt-7 overflow-hidden rounded-[30px] border border-white/8 bg-[#121F2D] px-5 py-6" onPress={openRecentScan}>
                                <View style={styles.scanGlow} />
                                <View className="flex-row items-start justify-between">
                                    <View className="flex-1 pr-4">
                                        <Text className="text-[12px] font-extrabold uppercase tracking-[1.4px] text-[#F8B84E]">Recent scan</Text>
                                        <Text className="mt-3 text-[26px] font-black leading-8 text-white">
                                            {recentScan.ingredients.length ? 'Keep building from your latest ingredients.' : 'Start a new ingredient scan.'}
                                        </Text>
                                        <Text className="mt-3 text-[14px] leading-6 text-white/65">
                                            {recentScan.ingredients.length
                                                ? 'Tap to review the detected list and move straight into recipe results.'
                                                : 'Point the camera at produce, leftovers, or pantry items and let the app do the first pass.'}
                                        </Text>
                                    </View>
                                    <View className="rounded-full border border-white/10 bg-white/8 px-3 py-2">
                                        <Text className="text-[12px] font-bold text-white/75">{recentScan.ingredients.length ? `${recentScan.ingredients.length} items` : 'Camera ready'}</Text>
                                    </View>
                                </View>

                                <View className="mt-5 flex-row flex-wrap">
                                    {(recentScan.ingredients.length ? recentScan.ingredients : ['tomatoes', 'spinach', 'bread']).map((ingredient) => (
                                        <View key={ingredient} className="mb-2 mr-2 rounded-full border border-white/10 bg-white/7 px-3 py-2">
                                            <Text className="text-[13px] font-semibold capitalize text-white">{ingredient}</Text>
                                        </View>
                                    ))}
                                </View>
                            </Pressable>

                            <View className="mt-7 gap-3">
                                {menuIdeas.map((item) => (
                                    <View key={item.id} className="rounded-[26px] px-5 py-5" style={{ backgroundColor: item.bg }}>
                                        <View className="flex-row items-center justify-between">
                                            <Text className="text-[12px] font-extrabold uppercase tracking-[1.2px]" style={{ color: item.tone }}>{item.eyebrow}</Text>
                                            <View className="h-2.5 w-12 rounded-full" style={{ backgroundColor: item.tone }} />
                                        </View>
                                        <Text className="mt-4 text-[24px] font-black text-white">{item.title}</Text>
                                    </View>
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
    screen: { flex: 1, backgroundColor: '#081019' },
    scrollContent: { paddingBottom: 42 },
    pagePadding: { paddingHorizontal: 20 },
    orbTop: { position: 'absolute', top: -80, right: -70, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(245, 158, 11, 0.14)' },
    orbLeft: { position: 'absolute', top: 260, left: -90, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(34, 197, 94, 0.12)' },
    orbBottom: { position: 'absolute', bottom: 160, right: -30, width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(96, 165, 250, 0.11)' },
    hero: { overflow: 'hidden', borderRadius: 34, minHeight: 480, padding: 24, backgroundColor: '#101B28', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    heroGlowA: { position: 'absolute', top: -60, right: -50, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(245, 158, 11, 0.18)' },
    heroGlowB: { position: 'absolute', bottom: -80, left: -70, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(34, 197, 94, 0.15)' },
    heroBadge: { position: 'absolute', right: 18, top: 168, width: 148, borderRadius: 22, padding: 14, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    heroPill: { position: 'absolute', right: 22, bottom: 26, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#F8B84E' },
    scanGlow: { position: 'absolute', top: -50, right: -30, width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(248, 184, 78, 0.12)' },
});
