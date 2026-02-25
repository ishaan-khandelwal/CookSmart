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
    loginwithemail,
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

export default function LoginScreen({ navigation }) {
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

    // ── Email / Password Login ───────────────────────────────────────────────
    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter both email and password.');
            return;
        }
        setLoading(true);
        try {
            await loginwithemail(email, password);
            // Navigation handled automatically by onAuthStateChanged in AppNavigator
        } catch (error) {
            Alert.alert('Login Failed', error.message);
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
                    <Text style={styles.title}>Welcome Back</Text>
                    <Text style={styles.subtitle}>Sign in to continue</Text>

                    {/* Email */}
                    <View style={styles.fieldGroup}>
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
                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Password</Text>
                        <TextInput
                            placeholder="Enter your password"
                            placeholderTextColor="#aaa"
                            style={styles.input}
                            secureTextEntry
                            value={password}
                            onChangeText={setPassword}
                        />
                    </View>

                    {/* Forgot password */}
                    <TouchableOpacity style={styles.forgotRow}>
                        <Text style={styles.forgotText}>Forgot Password?</Text>
                    </TouchableOpacity>

                    {/* Login Button */}
                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>Login</Text>
                        )}
                    </TouchableOpacity>

                    {/* Divider */}
                    <View style={styles.dividerContainer}>
                        <View style={styles.line} />
                        <Text style={styles.orText}>OR CONTINUE WITH</Text>
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

                    {/* Sign Up Link */}
                    <View style={styles.signupRow}>
                        <Text style={styles.signupRowText}>Don't have an account? </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('CreateAccount')}>
                            <Text style={styles.signupLink}>Sign Up</Text>
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
        fontSize: 30,
        fontWeight: 'bold',
        color: '#111',
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 15,
        color: '#777',
        marginBottom: 32,
    },
    fieldGroup: {
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
    forgotRow: {
        width: '100%',
        alignItems: 'flex-end',
        marginBottom: 20,
        marginTop: -6,
    },
    forgotText: {
        color: '#111',
        fontSize: 13,
        fontWeight: '600',
    },
    button: {
        backgroundColor: '#111',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        height: 50,
        width: '100%',
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
        marginBottom: 30,
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
    signupRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    signupRowText: {
        fontSize: 14,
        color: '#555',
    },
    signupLink: {
        fontSize: 14,
        color: '#111',
        fontWeight: 'bold',
        textDecorationLine: 'underline',
    },
});
