import { FontAwesome } from '@expo/vector-icons';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    createwithemsil,
    logout,
    signInWithFacebookCredential,
    signInWithGoogleCredential,
} from '../backend/auth';

// Required to close browser popup automatically after OAuth
WebBrowser.maybeCompleteAuthSession();

// ─── Replace with your real OAuth Client IDs ─────────────────────────────────
// Google: https://console.cloud.google.com → Credentials → OAuth 2.0
const GOOGLE_CLIENT_ID_EXPO = 'YOUR_GOOGLE_EXPO_CLIENT_ID.apps.googleusercontent.com';
const GOOGLE_CLIENT_ID_ANDROID = 'YOUR_GOOGLE_ANDROID_CLIENT_ID.apps.googleusercontent.com';
const GOOGLE_CLIENT_ID_IOS = 'YOUR_GOOGLE_IOS_CLIENT_ID.apps.googleusercontent.com';

// Facebook: https://developers.facebook.com → Your App → Settings → Basic
const FACEBOOK_APP_ID = 'YOUR_FACEBOOK_APP_ID';
// ─────────────────────────────────────────────────────────────────────────────

const googleDiscovery = {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

export default function CreateAccountScreen({ navigation }) {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    // ── Google Auth ──────────────────────────────────────────────────────────
    const [googleRequest, googleResponse, promptGoogleAsync] =
        AuthSession.useAuthRequest(
            {
                clientId: Platform.select({
                    ios: GOOGLE_CLIENT_ID_IOS,
                    android: GOOGLE_CLIENT_ID_ANDROID,
                    default: GOOGLE_CLIENT_ID_EXPO,
                }),
                scopes: ['openid', 'profile', 'email'],
                responseType: AuthSession.ResponseType.IdToken,
                redirectUri: AuthSession.makeRedirectUri({ useProxy: true }),
            },
            googleDiscovery
        );

    // Watch for Google response
    useState(() => {
        if (googleResponse?.type === 'success') {
            const { id_token } = googleResponse.params;
            handleGoogleCredential(id_token);
        }
    }, [googleResponse]);

    const handleGoogleCredential = async (idToken) => {
        setLoading(true);
        try {
            await signInWithGoogleCredential(idToken);
            // onAuthStateChanged in navigator will redirect to Home
        } catch (err) {
            Alert.alert('Google Sign-In Failed', err.message);
        } finally {
            setLoading(false);
        }
    };

    // ── Facebook Auth ────────────────────────────────────────────────────────
    const [fbRequest, fbResponse, promptFacebookAsync] =
        AuthSession.useAuthRequest(
            {
                clientId: FACEBOOK_APP_ID,
                scopes: ['public_profile', 'email'],
                redirectUri: AuthSession.makeRedirectUri({ useProxy: true }),
            },
            { authorizationEndpoint: 'https://www.facebook.com/v18.0/dialog/oauth' }
        );

    useState(() => {
        if (fbResponse?.type === 'success') {
            const { access_token } = fbResponse.params;
            handleFacebookCredential(access_token);
        }
    }, [fbResponse]);

    const handleFacebookCredential = async (accessToken) => {
        setLoading(true);
        try {
            await signInWithFacebookCredential(accessToken);
        } catch (err) {
            Alert.alert('Facebook Sign-In Failed', err.message);
        } finally {
            setLoading(false);
        }
    };

    // ── Email / Password Register ────────────────────────────────────────────
    const handleRegister = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please fill in all required fields.');
            return;
        }
        setLoading(true);
        try {
            await createwithemsil(email, password);
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
            style={{ flex: 1, backgroundColor: '#fff' }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.container}>
                    {/* Header */}
                    <Text style={styles.title}>Create Account</Text>
                    <Text style={styles.subtitle}>Sign up to get started</Text>

                    {/* Full Name */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Full Name</Text>
                        <TextInput
                            placeholder="Enter your full name"
                            placeholderTextColor="#aaa"
                            style={styles.input}
                            value={fullName}
                            onChangeText={setFullName}
                        />
                    </View>

                    {/* Email */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Email</Text>
                        <TextInput
                            placeholder="Enter your email"
                            placeholderTextColor="#aaa"
                            style={styles.input}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            value={email}
                            onChangeText={setEmail}
                        />
                    </View>

                    {/* Password */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Password</Text>
                        <TextInput
                            placeholder="Create a password"
                            placeholderTextColor="#aaa"
                            style={styles.input}
                            secureTextEntry
                            value={password}
                            onChangeText={setPassword}
                        />
                    </View>

                    {/* Register Button */}
                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleRegister}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>Create Account</Text>
                        )}
                    </TouchableOpacity>

                    {/* Divider */}
                    <View style={styles.dividerContainer}>
                        <View style={styles.line} />
                        <Text style={styles.orText}>OR SIGN UP WITH</Text>
                        <View style={styles.line} />
                    </View>

                    {/* Social Buttons */}
                    <View style={styles.socialRow}>
                        {/* Google */}
                        <TouchableOpacity
                            style={styles.socialButton}
                            onPress={() => promptGoogleAsync()}
                            disabled={!googleRequest || loading}
                        >
                            <FontAwesome name="google" size={20} color="#EA4335" />
                            <Text style={styles.socialButtonText}>Google</Text>
                        </TouchableOpacity>

                        {/* Facebook */}
                        <TouchableOpacity
                            style={[styles.socialButton, styles.facebookButton]}
                            onPress={() => promptFacebookAsync()}
                            disabled={!fbRequest || loading}
                        >
                            <FontAwesome name="facebook" size={20} color="#fff" />
                            <Text style={[styles.socialButtonText, { color: '#fff' }]}>Facebook</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Login Link */}
                    <View style={styles.loginRow}>
                        <Text style={styles.loginRowText}>Already have an account? </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                            <Text style={styles.loginLink}>Login</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
    },
    container: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 40,
        paddingHorizontal: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 15,
        color: '#777',
        marginBottom: 30,
    },
    inputContainer: {
        width: '100%',
        marginBottom: 4,
    },
    label: {
        marginBottom: 6,
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        backgroundColor: '#fafafa',
        borderRadius: 10,
        paddingHorizontal: 14,
        height: 48,
        marginBottom: 14,
        fontSize: 15,
        color: '#222',
    },
    button: {
        backgroundColor: '#111',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        height: 50,
        width: '100%',
        marginTop: 8,
        marginBottom: 24,
    },
    buttonDisabled: {
        backgroundColor: '#555',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        marginBottom: 20,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: '#ddd',
    },
    orText: {
        marginHorizontal: 10,
        color: '#999',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    socialRow: {
        flexDirection: 'row',
        width: '100%',
        gap: 12,
        marginBottom: 28,
    },
    socialButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 12,
        height: 48,
        backgroundColor: '#fff',
    },
    socialButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333',
    },
    facebookButton: {
        backgroundColor: '#1877F2',
        borderColor: '#1877F2',
    },
    loginRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    loginRowText: {
        fontSize: 14,
        color: '#555',
    },
    loginLink: {
        fontSize: 14,
        color: '#111',
        fontWeight: 'bold',
        textDecorationLine: 'underline',
    },
});
