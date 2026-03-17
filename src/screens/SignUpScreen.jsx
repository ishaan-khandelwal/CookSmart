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
import { logout, signUpWithEmail } from '../backend/auth';

export default function CreateAccountScreen({ navigation }) {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleRegister = async () => {
        if (!fullName || !email || !password) {
            Alert.alert('Error', 'Please fill in all required fields.');
            return;
        }

        setLoading(true);
        try {
            await signUpWithEmail(email, password, fullName);
            await logout();
            Alert.alert(
                'Account Created!',
                'Your account has been created. Please log in.',
                [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
            );
        } catch (error) {
            Alert.alert('Signup Failed', error.message);
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
                        <Text style={styles.title}>Create your account.</Text>
                        <Text style={styles.subtitle}>
                            Start building a smarter kitchen routine with saved recipes and meal planning.
                        </Text>
                    </View>

                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Text style={styles.cardTitle}>Sign Up</Text>
                            <Text style={styles.cardDescription}>
                                Set up your account in a minute and keep everything in one place.
                            </Text>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Full Name</Text>
                            <View style={styles.inputShell}>
                                <Feather name="user" size={19} color="#8A8A8A" />
                                <TextInput
                                    placeholder="Enter your full name"
                                    placeholderTextColor="#8A8A8A"
                                    style={styles.input}
                                    autoCapitalize="words"
                                    value={fullName}
                                    onChangeText={setFullName}
                                />
                            </View>
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
                                    placeholder="Create a password"
                                    placeholderTextColor="#8A8A8A"
                                    style={styles.input}
                                    secureTextEntry
                                    value={password}
                                    onChangeText={setPassword}
                                />
                            </View>
                        </View>

                        <View style={styles.noteBox}>
                            <Text style={styles.noteTitle}>Why join?</Text>
                            <Text style={styles.noteText}>
                                Save favorites, organize meals faster, and keep your cooking flow simple.
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
                            onPress={handleRegister}
                            disabled={loading}
                            activeOpacity={0.9}
                        >
                            {loading ? (
                                <ActivityIndicator color="#111111" />
                            ) : (
                                <>
                                    <Text style={styles.primaryButtonText}>Create Account</Text>
                                    <Feather name="arrow-right" size={18} color="#111111" />
                                </>
                            )}
                        </TouchableOpacity>

                        <View style={styles.dividerRow}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>Already a member?</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        <TouchableOpacity
                            style={styles.secondaryButton}
                            onPress={() => navigation.navigate('Login')}
                            activeOpacity={0.9}
                        >
                            <Text style={styles.secondaryButtonText}>Back to login</Text>
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
    },
    scrollView: {
        flex: 1,
        backgroundColor: '#111111',
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 36,
    },
    backgroundGlowTop: {
        position: 'absolute',
        top: 90,
        right: -40,
        width: 220,
        height: 220,
        borderRadius: 999,
        backgroundColor: 'rgba(34, 197, 94, 0.14)',
    },
    backgroundGlowBottom: {
        position: 'absolute',
        bottom: 80,
        left: -80,
        width: 280,
        height: 280,
        borderRadius: 999,
        backgroundColor: 'rgba(245, 158, 11, 0.14)',
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
        color: '#22C55E',
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
        maxWidth: 320,
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
    noteBox: {
        borderRadius: 18,
        backgroundColor: '#171717',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        padding: 16,
        marginBottom: 22,
    },
    noteTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#F6C453',
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    noteText: {
        fontSize: 14,
        lineHeight: 22,
        color: 'rgba(255, 255, 255, 0.68)',
    },
    primaryButton: {
        height: 56,
        borderRadius: 18,
        backgroundColor: '#22C55E',
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
