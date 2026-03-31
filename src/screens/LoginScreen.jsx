import { Feather, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signInWithEmail } from '../backend/auth';

export default function LoginScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const passwordInputRef = useRef(null);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter both email and password.');
            return;
        }

        setLoading(true);
        try {
            await signInWithEmail(email, password);
        } catch (error) {
            Alert.alert('Login Failed', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-[#111111]">
            <KeyboardAvoidingView
                className="flex-1 bg-[#111111]"
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <StatusBar barStyle="light-content" />

                <ScrollView
                    className="flex-1 bg-[#111111]"
                    contentContainerClassName="flex-grow px-6 pb-9 pt-6"
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
                    showsVerticalScrollIndicator={false}
                >
                    <View className="absolute right-[-50px] top-[70px] h-[220px] w-[220px] rounded-full bg-[#f59e0b2e]" />
                    <View className="absolute bottom-[120px] left-[-70px] h-[260px] w-[260px] rounded-full bg-[#22c55e1c]" />

                    <View className="min-h-full pb-6 pt-[48px]">
                        <View className="mb-7">
                            <View className="mb-[18px] h-14 w-14 items-center justify-center rounded-[18px] border border-white/10 bg-[#1d1d1d]">
                                <FontAwesome5 name="utensils" size={24} color="#FFF7ED" />
                            </View>
                            <Text className="mb-2.5 text-[13px] font-bold uppercase tracking-[1.1px] text-[#F59E0B]">CookSmart</Text>
                            <Text className="mb-2.5 text-[34px] font-extrabold text-white">Welcome back.</Text>
                            <Text className="max-w-[310px] text-[15px] leading-6 text-white/70">
                                Pick up where you left off and keep your meals organized beautifully.
                            </Text>
                        </View>

                        <View className="rounded-[28px] border border-white/10 bg-[#1c1c1cf5] p-[22px]">
                            <View className="mb-[22px]">
                                <Text className="mb-2 text-[26px] font-extrabold text-white">Login</Text>
                                <Text className="text-sm leading-[22px] text-white/60">
                                    Access your recipes, meal plans, and saved favorites.
                                </Text>
                            </View>

                            <View className="mb-4">
                                <Text className="mb-2 text-[13px] font-bold text-[#E8E8E8]">Email</Text>
                                <View className="min-h-14 flex-row items-center gap-3 rounded-[18px] border border-white/10 bg-[#151515] px-4">
                                    <MaterialCommunityIcons name="email-outline" size={20} color="#8A8A8A" />
                                    <TextInput
                                        placeholder="Enter your email"
                                        placeholderTextColor="#8A8A8A"
                                        className="flex-1 text-[15px] text-white"
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        autoComplete="email"
                                        textContentType="username"
                                        returnKeyType="next"
                                        blurOnSubmit={false}
                                        value={email}
                                        onChangeText={setEmail}
                                        onSubmitEditing={() => passwordInputRef.current?.focus()}
                                    />
                                </View>
                            </View>

                            <View className="mb-4">
                                <Text className="mb-2 text-[13px] font-bold text-[#E8E8E8]">Password</Text>
                                <View className="min-h-14 flex-row items-center gap-3 rounded-[18px] border border-white/10 bg-[#151515] px-4">
                                    <Feather name="lock" size={19} color="#8A8A8A" />
                                    <TextInput
                                        ref={passwordInputRef}
                                        placeholder="Enter your password"
                                        placeholderTextColor="#8A8A8A"
                                        className="flex-1 text-[15px] text-white"
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        spellCheck={false}
                                        autoComplete={Platform.OS === 'android' ? 'off' : 'current-password'}
                                        textContentType="password"
                                        returnKeyType="done"
                                        secureTextEntry={!showPassword}
                                        value={password}
                                        onChangeText={setPassword}
                                        onSubmitEditing={handleLogin}
                                    />
                                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                        <Text className="text-[13px] font-bold text-[#F6C453]">{showPassword ? 'Hide' : 'Show'}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <TouchableOpacity className="-mt-1 mb-6 self-end" activeOpacity={0.8}>
                                <Text className="text-[13px] font-bold text-[#F6C453]">Forgot Password?</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                className={`h-14 flex-row items-center justify-center gap-2.5 rounded-[18px] bg-[#F59E0B] ${loading ? 'opacity-70' : ''}`}
                                onPress={handleLogin}
                                disabled={loading}
                                activeOpacity={0.9}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#111111" />
                                ) : (
                                    <>
                                        <Text className="text-base font-extrabold text-[#111111]">Login</Text>
                                        <Feather name="arrow-right" size={18} color="#111111" />
                                    </>
                                )}
                            </TouchableOpacity>

                            <View className="my-5 flex-row items-center gap-3">
                                <View className="h-px flex-1 bg-white/10" />
                                <Text className="text-xs font-bold uppercase tracking-[0.6px] text-white/40">New here?</Text>
                                <View className="h-px flex-1 bg-white/10" />
                            </View>

                            <TouchableOpacity
                                className="h-[54px] items-center justify-center rounded-[18px] border border-white/10 bg-[#171717]"
                                onPress={() => navigation.navigate('CreateAccount')}
                                activeOpacity={0.9}
                            >
                                <Text className="text-[15px] font-bold text-white">Create an account</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
