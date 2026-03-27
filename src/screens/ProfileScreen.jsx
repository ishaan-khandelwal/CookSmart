import {
  ArrowLeft,
  Bell,
  ChevronRight,
  CreditCard,
  Gift,
  Heart,
  Info,
  MessageCircle,
  Star,
  User,
  Utensils,
  Wallet,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { logout } from '../backend/auth';
import { useAuth } from '../context/AuthContext';
import { fetchHistory } from '../services/api';
import { getStoredSpoonacularQuota } from '../services/spoonacularApi';

export default function ProfileScreen({ navigation }) {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [quota, setQuota] = useState(null);

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
      setHistory(data);
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

    return 'No activity saved yet. Search with ingredients to start building history.';
  }, [userId]);

  const handleBack = () => {
    if (navigation && navigation.navigate) {
      navigation.navigate('MainTabs', { screen: 'Home' });
    } else if (navigation && navigation.goBack) {
      navigation.goBack();
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      if (navigation && navigation.reset) {
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
    <SafeAreaView className="flex-1 bg-[#0D0D0D]">
      <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />

      <View className="absolute -top-[50px] -right-[50px] h-[200px] w-[200px] rounded-full bg-[#5C4A00] opacity-25" />
      <View className="absolute -bottom-[50px] -left-[50px] h-[250px] w-[250px] rounded-[125px] bg-[#1B3A2D] opacity-25" />

      <ScrollView contentContainerClassName="px-5 pb-10 pt-2.5">
        <View className="flex-row items-center justify-between py-4">
          <TouchableOpacity onPress={handleBack} className="w-10 items-start">
            <ArrowLeft color="#FFFFFF" size={22} />
          </TouchableOpacity>
          <Text className="text-[22px] font-bold text-white">Settings</Text>
          <View className="w-10" />
        </View>

        <View className="mb-6 mt-2.5 items-center">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-[#F5A623]">
            <Utensils color="#FFFFFF" size={40} />
          </View>
          <Text className="mt-3 text-xl font-bold text-white">{user?.displayName || 'User'}</Text>
          <Text className="mt-1 text-sm text-[#888888]">{user?.email || 'No email provided'}</Text>
          <Text className="mt-2 text-xs text-[#666666]">User ID: {userId || 'Not signed in'}</Text>
        </View>

        <View className="mb-6 flex-row justify-between gap-3">
          <TouchableOpacity className="flex-1 rounded-[20px] border border-[#2A2A2A] bg-[#1A1A1A] p-5" activeOpacity={0.7}>
            <View className="mb-4 h-12 w-12 items-center justify-center rounded-[14px] bg-[#141414]">
              <MessageCircle color="#F5A623" size={24} />
            </View>
            <Text className="mb-1 text-[15px] font-bold text-white">Help & Support</Text>
            <Text className="text-xs text-[#888888]">Open module</Text>
          </TouchableOpacity>

          <TouchableOpacity className="flex-1 rounded-[20px] border border-[#2A2A2A] bg-[#1A1A1A] p-5" activeOpacity={0.7}>
            <View className="mb-4 h-12 w-12 items-center justify-center rounded-[14px] bg-[#141414]">
              <Heart color="#4CAF50" size={24} />
            </View>
            <Text className="mb-1 text-[15px] font-bold text-white">Your Wishlist</Text>
            <Text className="text-xs text-[#888888]">Open module</Text>
          </TouchableOpacity>
        </View>

        <View className="mb-6">
          <Text className="ml-1 mb-2 text-[11px] font-semibold uppercase tracking-[1.5px] text-[#888888]">YOUR INFORMATION</Text>
          <View className="overflow-hidden rounded-[20px] border border-[#2A2A2A] bg-[#1A1A1A]">
            <ListItem
              icon={User}
              iconColor="#F5A623"
              label="Profile"
              onPress={() => Alert.alert('Your Information', `Name: ${user?.displayName || 'User'}\nEmail: ${user?.email || 'No email provided'}\nUser ID: ${userId || 'Not signed in'}`)}
            />
            <View className="ml-[68px] h-[1px] bg-[#2A2A2A]" />
            <ListItem icon={Heart} iconColor="#4CAF50" label="Your Wishlist" />
            <View className="ml-[68px] h-[1px] bg-[#2A2A2A]" />
            <ListItem icon={CreditCard} iconColor="#2196F3" label="E-Gift Cards" />
            <View className="ml-[68px] h-[1px] bg-[#2A2A2A]" />
            <ListItem icon={MessageCircle} iconColor="#F5A623" label="Help & Support" />
            <View className="ml-[68px] h-[1px] bg-[#2A2A2A]" />
            <ListItem icon={Gift} iconColor="#9C27B0" label="Rewards" />
            <View className="ml-[68px] h-[1px] bg-[#2A2A2A]" />
            <ListItem icon={Wallet} iconColor="#4CAF50" label="Payment Management" />
          </View>
        </View>

        <View className="mb-6">
          <Text className="ml-1 mb-2 text-[11px] font-semibold uppercase tracking-[1.5px] text-[#888888]">OTHER INFORMATION</Text>
          <View className="overflow-hidden rounded-[20px] border border-[#2A2A2A] bg-[#1A1A1A]">
            <View className="px-4 py-4">
              <View className="flex-row items-center">
                <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-[#141414]">
                  <Star color="#F5A623" size={18} />
                </View>
                <View className="flex-1">
                  <Text className="text-[15px] font-bold text-white">Spoonacular Credits</Text>
                  <Text className="mt-1 text-xs text-[#888888]">
                    {typeof quota?.remaining === 'number'
                      ? `${quota.remaining.toFixed(2)} left out of ${quota.dailyLimit}`
                      : 'Search recipes once to load your latest quota status.'}
                  </Text>
                  {quota?.updatedAt ? (
                    <Text className="mt-2 text-[11px] text-[#666666]">
                      Last updated: {formatDate(quota.updatedAt)}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
            <View className="ml-[68px] h-[1px] bg-[#2A2A2A]" />
            <ListItem icon={Bell} iconColor="#2196F3" label="Notifications" />
            <View className="ml-[68px] h-[1px] bg-[#2A2A2A]" />
            <ListItem icon={Info} iconColor="#888888" label="General Info" />
          </View>
        </View>

        <View className="mb-6">
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="ml-1 text-[11px] font-semibold uppercase tracking-[1.5px] text-[#888888]">HISTORY</Text>
            <TouchableOpacity onPress={loadHistory} activeOpacity={0.7}>
              <Text className="text-xs font-semibold text-[#F5A623]">Refresh</Text>
            </TouchableOpacity>
          </View>

          <View className="rounded-[20px] border border-[#2A2A2A] bg-[#1A1A1A] p-4">
            {historyLoading ? (
              <View className="items-center justify-center py-8">
                <ActivityIndicator size="small" color="#F5A623" />
              </View>
            ) : history.length ? (
              history.map((item, index) => (
                <View key={item._id || `${item.title}-${index}`} className={index ? 'mt-4 border-t border-[#2A2A2A] pt-4' : ''}>
                  <Text className="text-[15px] font-bold text-white">{item.title}</Text>
                  <Text className="mt-1 text-xs uppercase tracking-[1px] text-[#F5A623]">
                    {item.type || item.source || 'manual'} | {formatDate(item.createdAt)}
                  </Text>
                  <Text className="mt-2 text-sm leading-5 text-[#9A9A9A]">
                    {(item.ingredients || []).length ? item.ingredients.join(', ') : 'No ingredients captured'}
                  </Text>
                  {typeof item.resultCount === 'number' ? (
                    <Text className="mt-1 text-xs text-[#666666]">
                      Results returned: {item.resultCount}
                    </Text>
                  ) : null}
                </View>
              ))
            ) : (
              <Text className="text-sm leading-6 text-[#888888]">{historyEmptyMessage}</Text>
            )}
          </View>
        </View>

        <View className="mb-5 mt-2">
          <TouchableOpacity className="h-[54px] w-full items-center justify-center rounded-full border border-[#2A2A2A] bg-[#1A1A1A]" activeOpacity={0.7} onPress={handleLogout}>
            <Text className="text-base font-bold text-[#FF4444]">Log Out</Text>
          </TouchableOpacity>
          <Text className="mt-3 text-center text-xs text-[#555555]">App version 26.3.2 / v141-6</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
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

function ListItem({ icon: Icon, iconColor, label, onPress }) {
  return (
    <TouchableOpacity className="flex-row items-center justify-between px-4 py-3" activeOpacity={0.7} onPress={onPress}>
      <View className="flex-row items-center">
        <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl bg-[#141414]">
          <Icon color={iconColor} size={18} />
        </View>
        <Text className="text-[15px] font-bold text-white">{label}</Text>
      </View>
      <ChevronRight color="#555555" size={18} />
    </TouchableOpacity>
  );
}
