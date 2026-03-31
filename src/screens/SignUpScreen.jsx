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
import { logout, signUpWithEmail } from '../backend/auth';

export default function CreateAccountScreen({ navigation }) {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const emailInputRef = useRef(null);
    const passwordInputRef = useRef(null);

    const handleRegister = async () => {
        if (!fullName || !email || !password) {
            Alert.alert('Error', 'Please fill in all required fields.');
            return;
        }

        setLoading(true);
        try {
            await signUpWithEmail(email, password, fullName);
            await logout();
        } catch (error) {
            Alert.alert('Signup Failed', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            className="flex-1 bg-[#111111]"
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <StatusBar barStyle="light-content" />

            <ScrollView
                className="flex-1 bg-[#111111]"
                contentContainerClassName="flex-grow pb-9"
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
                showsVerticalScrollIndicator={false}
            >
                <View className="absolute right-[-40px] top-[90px] h-[220px] w-[220px] rounded-full bg-[#22c55e24]" />
                <View className="absolute bottom-20 left-[-80px] h-[280px] w-[280px] rounded-full bg-[#f59e0b24]" />

                <View className="min-h-full px-6 pb-6 pt-[72px]">
                    <View className="mb-7">
                        <View className="mb-[18px] h-14 w-14 items-center justify-center rounded-[18px] border border-white/10 bg-[#1d1d1d]">
                            <FontAwesome5 name="utensils" size={24} color="#FFF7ED" />
                        </View>
                        <Text className="mb-2.5 text-[13px] font-bold uppercase tracking-[1.1px] text-[#22C55E]">CookSmart</Text>
                        <Text className="mb-2.5 text-[34px] font-extrabold text-white">Create your account.</Text>
                        <Text className="max-w-[320px] text-[15px] leading-6 text-white/70">
                            Start building a smarter kitchen routine with saved recipes and meal planning.
                        </Text>
                    </View>

                    <View className="rounded-[28px] border border-white/10 bg-[#1c1c1cf5] p-[22px]">
                        <View className="mb-[22px]">
                            <Text className="mb-2 text-[26px] font-extrabold text-white">Sign Up</Text>
                            <Text className="text-sm leading-[22px] text-white/60">
                                Set up your account in a minute and keep everything in one place.
                            </Text>
                        </View>

                        <View className="mb-4">
                            <Text className="mb-2 text-[13px] font-bold text-[#E8E8E8]">Full Name</Text>
                            <View className="min-h-14 flex-row items-center gap-3 rounded-[18px] border border-white/10 bg-[#151515] px-4">
                                <Feather name="user" size={19} color="#8A8A8A" />
                                <TextInput
                                    placeholder="Enter your full name"
                                    placeholderTextColor="#8A8A8A"
                                    className="flex-1 text-[15px] text-white"
                                    autoCapitalize="words"
                                    returnKeyType="next"
                                    value={fullName}
                                    onChangeText={setFullName}
                                    onSubmitEditing={() => emailInputRef.current?.focus()}
                                />
                            </View>
                        </View>

                        <View className="mb-4">
                            <Text className="mb-2 text-[13px] font-bold text-[#E8E8E8]">Email</Text>
                            <View className="min-h-14 flex-row items-center gap-3 rounded-[18px] border border-white/10 bg-[#151515] px-4">
                                <MaterialCommunityIcons name="email-outline" size={20} color="#8A8A8A" />
                                <TextInput
                                    ref={emailInputRef}
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
                                    placeholder="Create a password"
                                    placeholderTextColor="#8A8A8A"
                                    className="flex-1 text-[15px] text-white"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    spellCheck={false}
                                    autoComplete={Platform.OS === 'android' ? 'off' : 'new-password'}
                                    textContentType="newPassword"
                                    returnKeyType="done"
                                    secureTextEntry
                                    value={password}
                                    onChangeText={setPassword}
                                    onSubmitEditing={handleRegister}
                                />
                            </View>
                        </View>

                        <View className="mb-5 rounded-2xl border border-white/10 bg-[#171717] p-4">
                            <Text className="mb-1.5 text-sm font-bold text-white">Why join?</Text>
                            <Text className="text-[14px] leading-5 text-white/65">
                                Save favorites, organize meals faster, and keep your cooking flow simple.
                            </Text>
                        </View>

                        <TouchableOpacity
                            className={`h-14 flex-row items-center justify-center gap-2.5 rounded-[18px] bg-[#22C55E] ${loading ? 'opacity-70' : ''}`}
                            onPress={handleRegister}
                            disabled={loading}
                            activeOpacity={0.9}
                        >
                            {loading ? (
                                <ActivityIndicator color="#111111" />
                            ) : (
                                <>
                                    <Text className="text-base font-extrabold text-[#111111]">Create Account</Text>
                                    <Feather name="arrow-right" size={18} color="#111111" />
                                </>
                            )}
                        </TouchableOpacity>

                        <View className="my-5 flex-row items-center gap-3">
                            <View className="h-px flex-1 bg-white/10" />
                            <Text className="text-xs font-bold uppercase tracking-[0.6px] text-white/40">Already a member?</Text>
                            <View className="h-px flex-1 bg-white/10" />
                        </View>

                        <TouchableOpacity
                            className="h-[54px] items-center justify-center rounded-[18px] border border-white/10 bg-[#171717]"
                            onPress={() => navigation.navigate('Login')}
                            activeOpacity={0.9}
                        >
                            <Text className="text-[15px] font-bold text-white">Back to login</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
