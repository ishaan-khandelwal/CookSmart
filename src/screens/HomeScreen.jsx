import { Feather, FontAwesome5 } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
    Alert,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
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

export default function HomeScreen({ navigation }) {
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
        <View style={styles.screen}>
            <StatusBar barStyle="light-content" />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                <View style={styles.backgroundGlowTop} />
                <View style={styles.backgroundGlowBottom} />

                <View style={styles.headerRow}>
                    <View>
                        <Text style={styles.headerLabel}>CookSmart Dashboard</Text>
                        <Text style={styles.headerTitle}>Hi, {firstName}</Text>
                    </View>

                    <TouchableOpacity
                        style={styles.logoutButton}
                        onPress={handleLogout}
                        disabled={loggingOut}
                        activeOpacity={0.85}
                    >
                        <Feather name="log-out" size={16} color="#F8FAFC" />
                        <Text style={styles.logoutText}>
                            {loggingOut ? 'Signing out' : 'Logout'}
                        </Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.heroCard}>
                    <View style={styles.heroBadge}>
                        <FontAwesome5 name="utensils" size={18} color="#111111" />
                        <Text style={styles.heroBadgeText}>Today&apos;s Kitchen Flow</Text>
                    </View>

                    <Text style={styles.heroTitle}>Smarter cooking starts with what you already have.</Text>
                    <Text style={styles.heroDescription}>
                        Organize ingredients, discover quick meals, and turn routine cooking into a cleaner system.
                    </Text>

                    <View style={styles.heroStatsRow}>
                        <View style={styles.statCard}>
                            <Text style={styles.statValue}>12</Text>
                            <Text style={styles.statLabel}>Recipes saved</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Text style={styles.statValue}>4</Text>
                            <Text style={styles.statLabel}>Meals planned</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Text style={styles.statValue}>86%</Text>
                            <Text style={styles.statLabel}>Pantry used</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Quick actions</Text>
                    <Text style={styles.sectionHint}>Shortcuts for your daily flow</Text>
                </View>

                <View style={styles.actionsGrid}>
                    {quickActions.map((action) => (
                        <TouchableOpacity key={action.id} style={styles.actionCard} activeOpacity={0.9}>
                            <View style={[styles.actionIconWrap, { backgroundColor: action.accent }]}>
                                <Feather name={action.icon} size={18} color="#111111" />
                            </View>
                            <Text style={styles.actionTitle}>{action.title}</Text>
                            <Text style={styles.actionMeta}>Open module</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Featured ideas</Text>
                    <Text style={styles.sectionHint}>Balanced around your project style</Text>
                </View>

                {featuredRecipes.map((item) => (
                    <View key={item.id} style={[styles.recipeCard, { backgroundColor: item.bg }]}>
                        <View style={styles.recipeCardTop}>
                            <View style={[styles.recipeAccent, { backgroundColor: item.tone }]} />
                            <Text style={styles.recipeTime}>{item.time}</Text>
                        </View>
                        <Text style={styles.recipeTitle}>{item.title}</Text>
                        <Text style={styles.recipeText}>
                            Fast, clean, and practical for a weekday meal plan.
                        </Text>
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#111111',
        margin: 0,
        padding: 0,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 64,
        paddingBottom: 36,
    },
    backgroundGlowTop: {
        position: 'absolute',
        top: 90,
        right: -40,
        width: 220,
        height: 220,
        borderRadius: 999,
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
    },
    backgroundGlowBottom: {
        position: 'absolute',
        bottom: 120,
        left: -70,
        width: 240,
        height: 240,
        borderRadius: 999,
        backgroundColor: 'rgba(34, 197, 94, 0.10)',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 26,
    },
    headerLabel: {
        color: '#F59E0B',
        fontSize: 12,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 30,
        fontWeight: '800',
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#1C1C1C',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    logoutText: {
        color: '#F8FAFC',
        fontSize: 13,
        fontWeight: '700',
    },
    heroCard: {
        backgroundColor: '#181818',
        borderRadius: 28,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        padding: 22,
        marginBottom: 28,
    },
    heroBadge: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#F59E0B',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 16,
    },
    heroBadgeText: {
        color: '#111111',
        fontSize: 12,
        fontWeight: '800',
    },
    heroTitle: {
        color: '#FFFFFF',
        fontSize: 28,
        fontWeight: '800',
        lineHeight: 36,
        marginBottom: 10,
    },
    heroDescription: {
        color: 'rgba(255, 255, 255, 0.68)',
        fontSize: 15,
        lineHeight: 24,
        marginBottom: 22,
    },
    heroStatsRow: {
        flexDirection: 'row',
        gap: 12,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#121212',
        borderRadius: 18,
        paddingVertical: 16,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    statValue: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 4,
    },
    statLabel: {
        color: 'rgba(255, 255, 255, 0.58)',
        fontSize: 12,
        lineHeight: 18,
    },
    sectionHeader: {
        marginBottom: 14,
    },
    sectionTitle: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 4,
    },
    sectionHint: {
        color: 'rgba(255, 255, 255, 0.56)',
        fontSize: 13,
    },
    actionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 28,
    },
    actionCard: {
        width: '48%',
        backgroundColor: '#181818',
        borderRadius: 22,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        padding: 18,
        marginBottom: 14,
    },
    actionIconWrap: {
        width: 42,
        height: 42,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    actionTitle: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 6,
    },
    actionMeta: {
        color: 'rgba(255, 255, 255, 0.50)',
        fontSize: 12,
    },
    recipeCard: {
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
    },
    recipeCardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    recipeAccent: {
        width: 34,
        height: 8,
        borderRadius: 999,
    },
    recipeTime: {
        color: 'rgba(255, 255, 255, 0.74)',
        fontSize: 12,
        fontWeight: '700',
    },
    recipeTitle: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: '800',
        marginBottom: 8,
    },
    recipeText: {
        color: 'rgba(255, 255, 255, 0.70)',
        fontSize: 14,
        lineHeight: 22,
    },
    bottomPanel: {
        marginTop: 8,
        backgroundColor: '#171717',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        padding: 18,
    },
    bottomPanelHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    bottomPanelTitle: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
    },
    bottomPanelText: {
        color: 'rgba(255, 255, 255, 0.66)',
        fontSize: 14,
        lineHeight: 22,
    },
});
