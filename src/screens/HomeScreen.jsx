import { Feather, FontAwesome5 } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
    Alert,
    ScrollView,
    StatusBar,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { logout } from '../backend/auth';
import { useAuth } from '../context/AuthContext';

const featuredRecipes = [
    {
        id: '1',
        title: 'Creamy Garlic Pasta',
        time: '20 min',
        tone: '#F59E0B',
        bg: '#221A0E',
    },
    {
        id: '2',
        title: 'Green Power Bowl',
        time: '15 min',
        tone: '#22C55E',
        bg: '#102015',
    },
];

const quickActions = [
    {
        id: 'scan',
        title: 'Scan Ingredients',
        icon: 'camera',
        accent: '#F59E0B',
    },
    {
        id: 'favorites',
        title: 'Saved Recipes',
        icon: 'heart',
        accent: '#22C55E',
    },
    {
        id: 'planner',
        title: 'Meal Planner',
        icon: 'calendar',
        accent: '#60A5FA',
    },
];

export default function HomeScreen() {
    const { user } = useAuth();
    const [loggingOut, setLoggingOut] = useState(false);

    const firstName = useMemo(() => {
        if (user?.displayName) {
            return user.displayName.split(' ')[0];
        }

        return 'Chef';
    }, [user]);

    const handleLogout = async () => {
        try {
            setLoggingOut(true);
            await logout();
        } catch (error) {
            Alert.alert('Logout Failed', error.message);
        } finally {
            setLoggingOut(false);
        }
    };

    return (
        <View className="flex-1 bg-[#111111]">
            <StatusBar barStyle="light-content" />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerClassName="px-5 pt-16 pb-9"
            >
                <View className="absolute right-[-40px] top-[90px] h-[220px] w-[220px] rounded-full bg-[#f59e0b26]" />
                <View className="absolute bottom-[120px] left-[-70px] h-[240px] w-[240px] rounded-full bg-[#22c55e1a]" />

                <View className="mb-[26px] flex-row items-center justify-between">
                    <View>
                        <Text className="mb-2 text-xs font-extrabold uppercase tracking-[1px] text-[#F59E0B]">CookSmart Dashboard</Text>
                        <Text className="text-[30px] font-extrabold text-white">Hi, {firstName}</Text>
                    </View>

                    <TouchableOpacity
                        className="flex-row items-center gap-2 rounded-2xl border border-white/10 bg-[#1C1C1C] px-[14px] py-3"
                        onPress={handleLogout}
                        disabled={loggingOut}
                        activeOpacity={0.85}
                    >
                        <Feather name="log-out" size={16} color="#F8FAFC" />
                        <Text className="text-[13px] font-bold text-slate-50">{loggingOut ? 'Signing out' : 'Logout'}</Text>
                    </TouchableOpacity>
                </View>

                <View className="mb-7 rounded-[28px] border border-white/10 bg-[#181818] p-[22px]">
                    <View className="mb-4 flex-row items-center self-start rounded-full bg-[#F59E0B] px-3 py-2">
                        <FontAwesome5 name="utensils" size={18} color="#111111" />
                        <Text className="ml-2 text-xs font-extrabold text-[#111111]">Today's Kitchen Flow</Text>
                    </View>

                    <Text className="mb-2.5 text-[28px] font-extrabold leading-9 text-white">
                        Smarter cooking starts with what you already have.
                    </Text>
                    <Text className="mb-5 text-[15px] leading-6 text-white/70">
                        Organize ingredients, discover quick meals, and turn routine cooking into a cleaner system.
                    </Text>

                    <View className="flex-row gap-3">
                        <View className="flex-1 rounded-2xl bg-white/5 p-4">
                            <Text className="text-[24px] font-extrabold text-white">12</Text>
                            <Text className="mt-1 text-[13px] text-white/60">Recipes saved</Text>
                        </View>
                        <View className="flex-1 rounded-2xl bg-white/5 p-4">
                            <Text className="text-[24px] font-extrabold text-white">4</Text>
                            <Text className="mt-1 text-[13px] text-white/60">Meals planned</Text>
                        </View>
                        <View className="flex-1 rounded-2xl bg-white/5 p-4">
                            <Text className="text-[24px] font-extrabold text-white">86%</Text>
                            <Text className="mt-1 text-[13px] text-white/60">Pantry used</Text>
                        </View>
                    </View>
                </View>

                <View className="mb-4">
                    <Text className="text-[22px] font-bold text-white">Quick actions</Text>
                    <Text className="mt-1 text-sm text-white/55">Shortcuts for your daily flow</Text>
                </View>

                <View className="mb-7 flex-row gap-3">
                    {quickActions.map((action) => (
                        <TouchableOpacity key={action.id} className="flex-1 rounded-[22px] border border-white/10 bg-[#171717] p-4" activeOpacity={0.9}>
                            <View className="mb-4 h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: action.accent }}>
                                <Feather name={action.icon} size={18} color="#111111" />
                            </View>
                            <Text className="text-[15px] font-bold text-white">{action.title}</Text>
                            <Text className="mt-1 text-[13px] text-white/50">Open module</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View className="mb-4">
                    <Text className="text-[22px] font-bold text-white">Featured ideas</Text>
                    <Text className="mt-1 text-sm text-white/55">Balanced around your project style</Text>
                </View>

                {featuredRecipes.map((item) => (
                    <View key={item.id} className="mb-3.5 rounded-[24px] p-5" style={{ backgroundColor: item.bg }}>
                        <View className="mb-3 flex-row items-center justify-between">
                            <View className="h-3 w-12 rounded-full" style={{ backgroundColor: item.tone }} />
                            <Text className="text-[13px] font-semibold text-white/70">{item.time}</Text>
                        </View>
                        <Text className="mb-1.5 text-xl font-bold text-white">{item.title}</Text>
                        <Text className="text-[14px] leading-5 text-white/65">
                            Fast, clean, and practical for a weekday meal plan.

                        </Text>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}
