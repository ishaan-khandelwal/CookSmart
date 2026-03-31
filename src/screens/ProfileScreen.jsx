import {
    ArrowLeft,
    Bell,
    ChevronRight,
    Heart,
    LogOut,
    MessageCircle,
    Star,
    User,
    Utensils
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StatusBar,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { logout } from '../backend/auth';
import { BOTTOM_TAB_BAR_RESERVED_SPACE } from '../components/BottomTabBar';
import { useAuth } from '../context/AuthContext';
import { fetchHistory } from '../services/api';
import { getStoredSpoonacularQuota } from '../services/spoonacularApi';

export default function ProfileScreen({ navigation }) {
    const { user } = useAuth();
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [quota, setQuota] = useState(null);
    const [accountInfoVisible, setAccountInfoVisible] = useState(false);

    const userId = user?.uid;

    const loadHistory = useCallback(async () => {
        if (!userId) {
            setHistory([]);
            setHistoryLoading(false);
            return;
        }

        try {
            setHistoryLoading(true);
            const data = await fetchHistory(userId);
            setHistory(Array.isArray(data) ? data : []);
        } catch (error) {
            Alert.alert('History Error', error.message);
        } finally {
            setHistoryLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    useEffect(() => {
        const unsubscribe = navigation?.addListener?.('focus', loadHistory);
        return unsubscribe;
    }, [loadHistory, navigation]);

    useEffect(() => {
        const loadQuota = async () => {
            const storedQuota = await getStoredSpoonacularQuota();
            setQuota(storedQuota);
        };

        loadQuota();

        const unsubscribe = navigation?.addListener?.('focus', loadQuota);
        return unsubscribe;
    }, [navigation]);

    const historyEmptyMessage = useMemo(() => {
        if (!userId) {
            return 'Sign in to store and view your activity history.';
        }

        return 'No activity saved yet. Scan ingredients or search recipes to start building your timeline.';
    }, [userId]);

    const handleBack = () => {
        if (navigation?.navigate) {
            navigation.navigate('MainTabs', { screen: 'Home' });
        } else if (navigation?.goBack) {
            navigation.goBack();
        }
    };

    const handleLogout = async () => {
        try {
            await logout();
            if (navigation?.reset) {
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'Login' }],
                });
            }
        } catch (error) {
            Alert.alert('Logout Error', error.message);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-[#07141d]" edges={['top', 'left', 'right']}>
            <StatusBar barStyle="light-content" backgroundColor="#07141d" />

            <ScrollView
                contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: BOTTOM_TAB_BAR_RESERVED_SPACE + 24 }}
                showsVerticalScrollIndicator={false}
            >
                <View className="mb-4 flex-row items-center justify-between">
                    <TouchableOpacity onPress={handleBack} className="h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#0d1721]" activeOpacity={0.85}>
                        <ArrowLeft color="#FFFFFF" size={20} />
                    </TouchableOpacity>
                    <Text className="text-xl font-bold text-white">Profile</Text>
                    <View className="h-11 w-11" />
                </View>

                <View className="overflow-hidden rounded-[34px] border border-white/10 bg-[#0d1721] px-5 pb-6 pt-6">
                    <View className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#f6b44f1f]" />
                    <View className="absolute -bottom-14 -left-10 h-32 w-32 rounded-full bg-[#00c89614]" />

                    <View className="flex-row items-center justify-between">
                        <View className="flex-1 pr-4">
                            <Text className="text-[11px] font-extrabold uppercase tracking-[1.6px] text-[#F6B44F]">Kitchen Account</Text>
                            <Text className="mt-2 text-[30px] font-black text-white">{user?.displayName || 'CookSmart User'}</Text>
                            {/* <Text className="mt-2 text-sm leading-6 text-[#94A7B8]">{user?.email || 'No email provided'}</Text> */}
                        </View>
                        <View className="h-16 w-16 items-center justify-center rounded-full bg-[#F6B44F]">
                            <Utensils color="#08131C" size={28} />
                        </View>
                    </View>

                    <View className="mt-5 flex-row gap-3">
                        <ProfileStat label="Saved" value={history.length} accent="#F6B44F" />
                        <ProfileStat label="Quota" value={typeof quota?.remaining === 'number' ? quota.remaining.toFixed(0) : '--'} accent="#00C896" />
                        <ProfileStat label="Mode" value={userId ? 'Cloud' : 'Guest'} accent="#60A5FA" />
                    </View>
                </View>

                <View className="mt-6">
                    <Text className="mb-3 text-[11px] font-extrabold uppercase tracking-[1.6px] text-[#6D8296]">Quick Actions</Text>
                    <View className="overflow-hidden rounded-[28px] border border-white/10 bg-[#0d1721]">
                        <ProfileRow icon={User} iconColor="#F6B44F" label="Account details" onPress={() => setAccountInfoVisible(true)} />
                        <Divider />
                        <ProfileRow icon={Heart} iconColor="#00C896" label="Saved recipes" onPress={() => navigation.navigate('Recipes')} />
                        <Divider />
                        <ProfileRow icon={MessageCircle} iconColor="#F6B44F" label="Help & support" onPress={() => navigation.navigate('HelpSupport')} />
                        <Divider />
                        <ProfileRow icon={Bell} iconColor="#60A5FA" label="Notifications" />
                    </View>
                </View>

                <View className="mt-6 overflow-hidden rounded-[28px] border border-white/10 bg-[#0d1721] px-5 pb-5 pt-5">
                    <View className="flex-row items-start justify-between">
                        <View className="flex-1 pr-4">
                            <Text className="text-[11px] font-extrabold uppercase tracking-[1.6px] text-[#F6B44F]">Recipe Credits</Text>
                            <Text className="mt-2 text-[24px] font-black text-white">Search quota snapshot</Text>
                            <Text className="mt-2 text-sm leading-6 text-[#94A7B8]">
                                {typeof quota?.remaining === 'number'
                                    ? `${quota.remaining.toFixed(0)} Spoonacular credits left from your most recent synced snapshot.`
                                    : 'Your latest quota snapshot will appear here after a recipe search.'}
                            </Text>
                        </View>
                        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#f6b44f14]">
                            <Star color="#F6B44F" size={20} />
                        </View>
                    </View>
                    {quota?.updatedAt ? (
                        <Text className="mt-4 text-[12px] text-[#6D8296]">Updated {formatDate(quota.updatedAt)}</Text>
                    ) : null}
                </View>

                <View className="mt-6">
                    <View className="mb-3 flex-row items-center justify-between">
                        <Text className="text-[11px] font-extrabold uppercase tracking-[1.6px] text-[#6D8296]">Recent Activity</Text>
                        <TouchableOpacity onPress={loadHistory} activeOpacity={0.85}>
                            <Text className="text-[12px] font-bold text-[#F6B44F]">Refresh</Text>
                        </TouchableOpacity>
                    </View>

                    <View className="rounded-[28px] border border-white/10 bg-[#0d1721] p-5">
                        {historyLoading ? (
                            <View className="items-center justify-center py-10">
                                <ActivityIndicator size="small" color="#F6B44F" />
                            </View>
                        ) : history.length ? (
                            history.slice(0, 8).map((item, index) => (
                                <View key={item._id || `${item.title}-${index}`} className={index ? 'mt-4 border-t border-white/8 pt-4' : ''}>
                                    <Text className="text-[16px] font-bold text-white">{item.title}</Text>
                                    <Text className="mt-1 text-[11px] font-extrabold uppercase tracking-[1px] text-[#F6B44F]">
                                        {item.type || item.source || 'manual'} - {formatDate(item.createdAt)}
                                    </Text>
                                    <Text className="mt-2 text-sm leading-6 text-[#95A8B9]">
                                        {(item.ingredients || []).length ? item.ingredients.join(', ') : 'No ingredients captured for this entry.'}
                                    </Text>
                                    {typeof item.resultCount === 'number' ? (
                                        <Text className="mt-2 text-[12px] text-[#6D8296]">Results returned: {item.resultCount}</Text>
                                    ) : null}
                                </View>
                            ))
                        ) : (
                            <Text className="text-sm leading-6 text-[#95A8B9]">{historyEmptyMessage}</Text>
                        )}
                    </View>
                </View>

                <TouchableOpacity className="mt-6 flex-row items-center justify-center rounded-full border border-[#ff6b6b33] bg-[#30181c] px-5 py-4" activeOpacity={0.85} onPress={handleLogout}>
                    <LogOut color="#FF7F7F" size={18} />
                    <Text className="ml-2 text-[14px] font-black uppercase tracking-[0.8px] text-[#FF8E8E]">Log Out</Text>
                </TouchableOpacity>
            </ScrollView>

            <Modal
                visible={accountInfoVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setAccountInfoVisible(false)}
            >
                <Pressable className="flex-1 items-center justify-center bg-[#02070ccc] px-6" onPress={() => setAccountInfoVisible(false)}>
                    <Pressable className="w-full max-w-[360px] rounded-[30px] border border-white/10 bg-[#0d1721] px-5 pb-5 pt-6">
                        <Text className="text-[11px] font-extrabold uppercase tracking-[1.6px] text-[#F6B44F]">Your Information</Text>
                        <Text className="mt-3 text-[28px] font-black text-white">{user?.displayName || 'User'}</Text>
                        <View className="mt-5 gap-4">
                            <InfoRow label="Email" value={user?.email || 'No email provided'} />
                            <InfoRow label="User ID" value={userId || 'Not signed in'} />
                        </View>
                        <TouchableOpacity
                            className="mt-6 items-center rounded-[20px] bg-[#F6B44F] px-4 py-3.5"
                            activeOpacity={0.85}
                            onPress={() => setAccountInfoVisible(false)}
                        >
                            <Text className="text-[13px] font-black uppercase tracking-[0.8px] text-[#08131c]">Close</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

function ProfileStat({ label, value, accent }) {
    return (
        <View className="min-w-0 flex-1 rounded-[22px] border border-white/8 bg-white/5 px-3 py-3">
            <View className="mb-3 h-1.5 w-10 rounded-full" style={{ backgroundColor: accent }} />
            <Text className="text-[22px] font-black text-white">{value}</Text>
            <Text className="mt-1 text-[11px] font-semibold uppercase tracking-[1px] text-[#71869A]">{label}</Text>
        </View>
    );
}

function Divider() {
    return <View className="ml-[68px] h-px bg-white/8" />;
}

function ProfileRow({ icon: Icon, iconColor, label, onPress }) {
    return (
        <TouchableOpacity className="flex-row items-center justify-between px-4 py-4" activeOpacity={0.85} onPress={onPress}>
            <View className="flex-row items-center">
                <View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl bg-[#08131c]">
                    <Icon color={iconColor} size={18} />
                </View>
                <Text className="text-[15px] font-bold text-white">{label}</Text>
            </View>
            <ChevronRight color="#6D8296" size={18} />
        </TouchableOpacity>
    );
}

function InfoRow({ label, value }) {
    return (
        <View className="rounded-[20px] border border-white/8 bg-white/5 px-4 py-3.5">
            <Text className="text-[11px] font-extrabold uppercase tracking-[1.2px] text-[#6D8296]">{label}</Text>
            <Text className="mt-2 text-[15px] leading-6 text-white">{value}</Text>
        </View>
    );
}

function formatDate(value) {
    if (!value) {
        return 'Unknown time';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'Unknown time';
    }

    return date.toLocaleString();
}
