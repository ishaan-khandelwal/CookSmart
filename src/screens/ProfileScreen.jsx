import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />

      {/* Decorative Blobs */}
      <View style={styles.topRightBlob} />
      <View style={styles.bottomLeftBlob} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.headerIcon}>
            <ArrowLeft color="#FFFFFF" size={22} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* USER INFO BLOCK */}
        <View style={styles.userInfoBlock}>
          <View style={styles.avatarContainer}>
            <Utensils color="#FFFFFF" size={40} />
          </View>
          <Text style={styles.userName}>{user?.displayName || 'User'}</Text>
          <Text style={styles.userPhone}>{user?.email || 'No email provided'}</Text>
        </View>

        {/* QUICK ACTION CARDS */}
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity style={styles.quickActionCard} activeOpacity={0.7}>
            <View style={styles.quickActionBadge}>
              <MessageCircle color="#F5A623" size={24} />
            </View>
            <Text style={styles.quickActionLabel}>Help & Support</Text>
            <Text style={styles.quickActionSubtitle}>Open module</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickActionCard} activeOpacity={0.7}>
            <View style={styles.quickActionBadge}>
              <Heart color="#4CAF50" size={24} />
            </View>
            <Text style={styles.quickActionLabel}>Your Wishlist</Text>
            <Text style={styles.quickActionSubtitle}>Open module</Text>
          </TouchableOpacity>
        </View>

        {/* YOUR INFORMATION SECTION */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>YOUR INFORMATION</Text>
          <View style={styles.cardContainer}>
            <ListItem 
              icon={User} 
              iconColor="#F5A623" 
              label="Profile" 
              onPress={() => Alert.alert('Your Information', `Name: ${user?.displayName || 'User'}\nEmail: ${user?.email || 'No email provided'}`)}
            />
            <View style={styles.divider} />
            <ListItem icon={Heart} iconColor="#4CAF50" label="Your Wishlist" />
            <View style={styles.divider} />
            <ListItem icon={CreditCard} iconColor="#2196F3" label="E-Gift Cards" />
            <View style={styles.divider} />
            <ListItem icon={MessageCircle} iconColor="#F5A623" label="Help & Support" />
            <View style={styles.divider} />
            <ListItem icon={Gift} iconColor="#9C27B0" label="Rewards" />
            <View style={styles.divider} />
            <ListItem icon={Wallet} iconColor="#4CAF50" label="Payment Management" />
          </View>
        </View>

        {/* OTHER INFORMATION SECTION */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>OTHER INFORMATION</Text>
          <View style={styles.cardContainer}>
            <ListItem icon={Star} iconColor="#F5A623" label="Suggest Products" />
            <View style={styles.divider} />
            <ListItem icon={Bell} iconColor="#2196F3" label="Notifications" />
            <View style={styles.divider} />
            <ListItem icon={Info} iconColor="#888888" label="General Info" />
          </View>
        </View>

        {/* FOOTER */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.logoutButton} activeOpacity={0.7} onPress={handleLogout}>
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
          <Text style={styles.versionText}>App version 26.3.2 / v141-6</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ListItem({ icon: Icon, iconColor, label, onPress }) {
  return (
    <TouchableOpacity style={styles.listItem} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.listItemLeft}>
        <View style={styles.listItemBadge}>
          <Icon color={iconColor} size={18} />
        </View>
        <Text style={styles.listItemLabel}>{label}</Text>
      </View>
      <ChevronRight color="#555555" size={18} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 10,
  },
  topRightBlob: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#5C4A00',
    opacity: 0.25,
  },
  bottomLeftBlob: {
    position: 'absolute',
    bottom: -50,
    left: -50,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#1B3A2D',
    opacity: 0.25,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  headerIcon: {
    width: 40,
    alignItems: 'flex-start',
  },
  headerSpacer: {
    width: 40,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userInfoBlock: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 24,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F5A623',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 12,
  },
  userPhone: {
    fontSize: 14,
    color: '#888888',
    marginTop: 4,
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  quickActionBadge: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#141414',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  quickActionLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  quickActionSubtitle: {
    fontSize: 12,
    color: '#888888',
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    color: '#888888',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 8,
    marginLeft: 4,
    fontWeight: '600',
  },
  cardContainer: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listItemBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#141414',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  listItemLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  divider: {
    height: 1,
    backgroundColor: '#2A2A2A',
    marginLeft: 68,
  },
  footer: {
    marginTop: 8,
    marginBottom: 20,
  },
  logoutButton: {
    width: '100%',
    height: 54,
    backgroundColor: '#1A1A1A',
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF4444',
  },
  versionText: {
    fontSize: 12,
    color: '#555555',
    textAlign: 'center',
    marginTop: 12,
  },
});
