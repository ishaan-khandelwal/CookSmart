import { Feather, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { signInWithEmail } from '../backend/auth';

export default function LoginScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter both email and password.');
            return;
        }

        setLoading(true);
        try {
            await signInWithEmail(email, password);
            navigation.navigate('Home');
        } catch (error) {
            Alert.alert('Login Failed', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.screen}
        // behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        // keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        >
            <StatusBar barStyle="light-content" />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.backgroundGlowTop} />
                <View style={styles.backgroundGlowBottom} />

                <View style={styles.container}>
                    <View style={styles.hero}>
                        <View style={styles.logoWrap}>
                            <FontAwesome5 name="utensils" size={24} color="#FFF7ED" />
                        </View>
                        <Text style={styles.eyebrow}>CookSmart</Text>
                        <Text style={styles.title}>Welcome back.</Text>
                        <Text style={styles.subtitle}>
                            Pick up where you left off and keep your meals organized beautifully.
                        </Text>
                    </View>

                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Text style={styles.cardTitle}>Login</Text>
                            <Text style={styles.cardDescription}>
                                Access your recipes, meal plans, and saved favorites.
                            </Text>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email</Text>
                            <View style={styles.inputShell}>
                                <MaterialCommunityIcons
                                    name="email-outline"
                                    size={20}
                                    color="#8A8A8A"
                                />
                                <TextInput
                                    placeholder="Enter your email"
                                    placeholderTextColor="#8A8A8A"
                                    style={styles.input}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    value={email}
                                    onChangeText={setEmail}
                                />
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Password</Text>
                            <View style={styles.inputShell}>
                                <Feather name="lock" size={19} color="#8A8A8A" />
                                <TextInput
                                    placeholder="Enter your password"
                                    placeholderTextColor="#8A8A8A"
                                    style={styles.input}
                                    secureTextEntry
                                    value={password}
                                    onChangeText={setPassword}
                                />
                            </View>
                        </View>

                        <TouchableOpacity style={styles.utilityRow} activeOpacity={0.8}>
                            <Text style={styles.utilityText}>Forgot Password?</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
                            onPress={handleLogin}
                            disabled={loading}
                            activeOpacity={0.9}
                        >
                            {loading ? (
                                <ActivityIndicator color="#111111" />
                            ) : (
                                <>
                                    <Text style={styles.primaryButtonText}>Login</Text>
                                    <Feather name="arrow-right" size={18} color="#111111" />
                                </>
                            )}
                        </TouchableOpacity>

                        <View style={styles.dividerRow}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>New here?</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={() => navigation.navigate('CreateAccount')}
                            activeOpacity={0.9}
                        >
                            <Text style={styles.secondaryButtonText}>Create an account</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#111111',
        margin: 0,
        padding: 0,
        height: '100vh'
    },
    scrollView: {
        flex: 1,
        backgroundColor: '#111111',
        height: '150vh'
    },
    scrollContent: {
        flexGrow: 1,
        margin: 0,
        paddingBottom: 36,
    },
    backgroundGlowTop: {
        position: 'absolute',
        top: 70,
        right: -50,
        width: 220,
        height: 220,
        borderRadius: 999,
        backgroundColor: 'rgba(245, 158, 11, 0.18)',
    },
    backgroundGlowBottom: {
        position: 'absolute',
        bottom: 120,
        left: -70,
        width: 260,
        height: 260,
        borderRadius: 999,
        backgroundColor: 'rgba(34, 197, 94, 0.11)',
    },
    container: {
        minHeight: '100%',
        justifyContent: 'flex-start',
        paddingHorizontal: 24,
        paddingTop: 72,
        paddingBottom: 24,
    },
    hero: {
        marginBottom: 28,
    },
    logoWrap: {
        width: 56,
        height: 56,
        borderRadius: 18,
        backgroundColor: '#1D1D1D',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 18,
    },
    eyebrow: {
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 1.1,
        textTransform: 'uppercase',
        color: '#F59E0B',
        marginBottom: 10,
    },
    title: {
        fontSize: 34,
        fontWeight: '800',
        color: '#FFFFFF',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 15,
        lineHeight: 24,
        color: 'rgba(255, 255, 255, 0.72)',
        maxWidth: 310,
    },
    card: {
        backgroundColor: 'rgba(28, 28, 28, 0.96)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 28,
        padding: 22,
    },
    cardHeader: {
        marginBottom: 22,
    },
    cardTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    cardDescription: {
        fontSize: 14,
        lineHeight: 22,
        color: 'rgba(255, 255, 255, 0.62)',
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 13,
        fontWeight: '700',
        color: '#E8E8E8',
        marginBottom: 8,
    },
    inputShell: {
        minHeight: 56,
        borderRadius: 18,
        backgroundColor: '#151515',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    input: {
        flex: 1,
        fontSize: 15,
        color: '#FFFFFF',
    },
    utilityRow: {
        alignSelf: 'flex-end',
        marginBottom: 24,
        marginTop: -4,
    },
    utilityText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#F6C453',
    },
    primaryButton: {
        height: 56,
        borderRadius: 18,
        backgroundColor: '#F59E0B',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 10,
    },
    primaryButtonDisabled: {
        opacity: 0.7,
    },
    primaryButtonText: {
        fontSize: 16,
        fontWeight: '800',
        color: '#111111',
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 20,
        gap: 12,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    dividerText: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        color: 'rgba(255, 255, 255, 0.42)',
    },
    secondaryButton: {
        height: 54,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.10)',
        backgroundColor: '#171717',
        alignItems: 'center',
        justifyContent: 'center',
    },
    secondaryButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
