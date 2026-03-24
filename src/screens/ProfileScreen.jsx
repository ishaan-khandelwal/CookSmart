import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  Alert,
} from 'react-native';
import { logout } from '../backend/auth';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft,
  Utensils,
  MessageCircle,
  Heart,
  User,
  CreditCard,
  Gift,
  Wallet,
  Star,
  Bell,
  Info,
  ChevronRight,
} from 'lucide-react-native';

export default function ProfileScreen({ navigation }) {
  const { user } = useAuth();

  const handleBack = () => {
    if (navigation && navigation.navigate) {
      navigation.navigate('Dashboard');
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

      {/* Decorative Blobs */}
      <View className="absolute -top-[50px] -right-[50px] w-[200px] h-[200px] rounded-full bg-[#5C4A00] opacity-25" />
      <View className="absolute -bottom-[50px] -left-[50px] w-[250px] h-[250px] rounded-[125px] bg-[#1B3A2D] opacity-25" />

      <ScrollView contentContainerClassName="px-5 pb-10 pt-2.5">
        {/* HEADER */}
        <View className="flex-row items-center justify-between py-4">
          <TouchableOpacity onPress={handleBack} className="w-10 items-start">
            <ArrowLeft color="#FFFFFF" size={22} />
          </TouchableOpacity>
          <Text className="text-[22px] font-bold text-white">Settings</Text>
          <View className="w-10" />
        </View>

        {/* USER INFO BLOCK */}
        <View className="items-center mt-2.5 mb-6">
          <View className="w-20 h-20 rounded-full bg-[#F5A623] items-center justify-center">
            <Utensils color="#FFFFFF" size={40} />
          </View>
          <Text className="text-xl font-bold text-white mt-3">{user?.displayName || 'User'}</Text>
          <Text className="text-sm text-[#888888] mt-1">{user?.email || 'No email provided'}</Text>
        </View>

        {/* QUICK ACTION CARDS */}
        <View className="flex-row justify-between mb-6 gap-3">
          <TouchableOpacity className="flex-1 bg-[#1A1A1A] rounded-[20px] p-5 border border-[#2A2A2A]" activeOpacity={0.7}>
            <View className="w-12 h-12 rounded-[14px] bg-[#141414] items-center justify-center mb-4">
              <MessageCircle color="#F5A623" size={24} />
            </View>
            <Text className="text-[15px] font-bold text-white mb-1">Help & Support</Text>
            <Text className="text-xs text-[#888888]">Open module</Text>
          </TouchableOpacity>

          <TouchableOpacity className="flex-1 bg-[#1A1A1A] rounded-[20px] p-5 border border-[#2A2A2A]" activeOpacity={0.7}>
            <View className="w-12 h-12 rounded-[14px] bg-[#141414] items-center justify-center mb-4">
              <Heart color="#4CAF50" size={24} />
            </View>
            <Text className="text-[15px] font-bold text-white mb-1">Your Wishlist</Text>
            <Text className="text-xs text-[#888888]">Open module</Text>
          </TouchableOpacity>
        </View>

        {/* YOUR INFORMATION SECTION */}
        <View className="mb-6">
          <Text className="text-[11px] text-[#888888] uppercase tracking-[1.5px] mb-2 ml-1 font-semibold">YOUR INFORMATION</Text>
          <View className="bg-[#1A1A1A] rounded-[20px] border border-[#2A2A2A] overflow-hidden">
            <ListItem 
              icon={User} 
              iconColor="#F5A623" 
              label="Profile" 
              onPress={() => Alert.alert('Your Information', `Name: ${user?.displayName || 'User'}\nEmail: ${user?.email || 'No email provided'}`)}
            />
            <View className="h-[1px] bg-[#2A2A2A] ml-[68px]" />
            <ListItem icon={Heart} iconColor="#4CAF50" label="Your Wishlist" />
            <View className="h-[1px] bg-[#2A2A2A] ml-[68px]" />
            <ListItem icon={CreditCard} iconColor="#2196F3" label="E-Gift Cards" />
            <View className="h-[1px] bg-[#2A2A2A] ml-[68px]" />
            <ListItem icon={MessageCircle} iconColor="#F5A623" label="Help & Support" />
            <View className="h-[1px] bg-[#2A2A2A] ml-[68px]" />
            <ListItem icon={Gift} iconColor="#9C27B0" label="Rewards" />
            <View className="h-[1px] bg-[#2A2A2A] ml-[68px]" />
            <ListItem icon={Wallet} iconColor="#4CAF50" label="Payment Management" />
          </View>
        </View>

        {/* OTHER INFORMATION SECTION */}
        <View className="mb-6">
          <Text className="text-[11px] text-[#888888] uppercase tracking-[1.5px] mb-2 ml-1 font-semibold">OTHER INFORMATION</Text>
          <View className="bg-[#1A1A1A] rounded-[20px] border border-[#2A2A2A] overflow-hidden">
            <ListItem icon={Star} iconColor="#F5A623" label="Suggest Products" />
            <View className="h-[1px] bg-[#2A2A2A] ml-[68px]" />
            <ListItem icon={Bell} iconColor="#2196F3" label="Notifications" />
            <View className="h-[1px] bg-[#2A2A2A] ml-[68px]" />
            <ListItem icon={Info} iconColor="#888888" label="General Info" />
          </View>
        </View>

        {/* FOOTER */}
        <View className="mt-2 mb-5">
          <TouchableOpacity className="w-full h-[54px] bg-[#1A1A1A] rounded-full border border-[#2A2A2A] items-center justify-center" activeOpacity={0.7} onPress={handleLogout}>
            <Text className="text-base font-bold text-[#FF4444]">Log Out</Text>
          </TouchableOpacity>
          <Text className="text-xs text-[#555555] text-center mt-3">App version 26.3.2 / v141-6</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ListItem({ icon: Icon, iconColor, label, onPress }) {
  return (
    <TouchableOpacity className="flex-row items-center justify-between py-3 px-4" activeOpacity={0.7} onPress={onPress}>
      <View className="flex-row items-center">
        <View className="w-10 h-10 rounded-xl bg-[#141414] items-center justify-center mr-3">
          <Icon color={iconColor} size={18} />
        </View>
        <Text className="text-[15px] font-bold text-white">{label}</Text>
      </View>
      <ChevronRight color="#555555" size={18} />
    </TouchableOpacity>
  );
}
