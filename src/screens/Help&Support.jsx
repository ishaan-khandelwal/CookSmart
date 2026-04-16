import { ArrowLeft, MessageCircleQuestion, Send, Sparkles } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StatusBar,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_RECIPE_MODE, RECIPE_MODE_IDS } from '../constants/recipeModes';
import { useRecipeMode } from '../context/RecipeModeContext';
import { getHelpSupportReply } from '../services/helpSupportApi';
import { hasExpoEnv } from '../utils/expoConfig';

const RECENT_SCAN_KEY = 'cooksmart:lastScan';

const SUGGESTED_PROMPTS = [
    'What can I make from egg, onion, and tomato?',
    'Use my latest scanned ingredients',
    'Why is my ingredient scan blurry?',
    'I am not getting recipe results.',
];

const INITIAL_MESSAGE = {
    id: 'welcome',
    role: 'assistant',
    text: 'Hi, I am your CookSmart assistant. Ask what you can cook from your ingredients, or get help with scanning, recipes, account issues, favorites, and planner problems.',
};

function normalizeIngredients(items) {
    return Array.from(
        new Set(
            (items || [])
                .map((item) => String(item || '').trim().toLowerCase())
                .filter(Boolean),
        ),
    );
}

export default function HelpSupportScreen({ navigation }) {
    const { user } = useAuth();
    const { selectedMode } = useRecipeMode();
    const layoutScrollRef = useRef(null);
    const insets = useSafeAreaInsets();
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const [messages, setMessages] = useState([INITIAL_MESSAGE]);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const [availableIngredients, setAvailableIngredients] = useState([]);

    const supportStatus = useMemo(
        () => (hasExpoEnv('EXPO_PUBLIC_GEMINI_KEY') ? 'AI cooking assistant online' : 'Smart cooking fallback'),
        [],
    );

    const scrollToBottom = useCallback(() => {
        requestAnimationFrame(() => {
            layoutScrollRef.current?.scrollToEnd?.({ animated: true });
        });
    }, []);

    useEffect(() => {
        const showSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
            setKeyboardHeight(event.endCoordinates?.height || 0);
            scrollToBottom();
        });
        const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
            setKeyboardHeight(0);
        });
        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, [scrollToBottom]);

    useEffect(() => {
        let isMounted = true;

        AsyncStorage.getItem(RECENT_SCAN_KEY)
            .then((savedScan) => {
                if (!isMounted || !savedScan) return;

                const parsedScan = JSON.parse(savedScan);
                setAvailableIngredients(normalizeIngredients(parsedScan?.ingredients));
            })
            .catch(() => {
                if (isMounted) {
                    setAvailableIngredients([]);
                }
            });

        return () => {
            isMounted = false;
        };
    }, []);

    const handleBack = useCallback(() => {
        if (navigation.canGoBack()) {
            navigation.goBack();
            return;
        }

        navigation.navigate('MainTabs', { screen: 'Profile' });
    }, [navigation]);

    const sendMessage = useCallback(
        async (rawMessage) => {
            const trimmedMessage = String(rawMessage || '').trim();
            if (!trimmedMessage || sending) {
                return;
            }

            const userMessage = {
                id: `user-${Date.now()}`,
                role: 'user',
                text: trimmedMessage,
            };

            const nextMessages = [...messages, userMessage];
            setMessages(nextMessages);
            setDraft('');
            setSending(true);
            scrollToBottom();

            try {
                const reply = await getHelpSupportReply(trimmedMessage, {
                    history: nextMessages.map((message) => ({
                        role: message.role,
                        text: message.text,
                    })),
                    userName: user?.displayName || '',
                    availableIngredients,
                    recipeMode: selectedMode === RECIPE_MODE_IDS.COOK_FREEDOM ? RECIPE_MODE_IDS.COOK_FREEDOM : DEFAULT_RECIPE_MODE,
                });

                setMessages((current) => [
                    ...current,
                    {
                        id: `assistant-${Date.now()}`,
                        role: 'assistant',
                        text: reply,
                    },
                ]);
            } finally {
                setSending(false);
                scrollToBottom();
            }
        },
        [availableIngredients, messages, scrollToBottom, selectedMode, sending, user?.displayName],
    );

    return (
        <SafeAreaView className="flex-1 bg-[#07141d]" edges={['top', 'left', 'right', 'bottom']}>
            <StatusBar barStyle="light-content" backgroundColor="#07141d" />

            <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <ScrollView
                    ref={layoutScrollRef}
                    className="flex-1"
                    contentContainerStyle={{
                        paddingHorizontal: 20,
                        paddingTop: 8,
                        paddingBottom: Math.max(20, keyboardHeight - insets.bottom + 20),
                    }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    onContentSizeChange={scrollToBottom}
                >
                    <View className="mb-4 flex-row items-center justify-between">
                        <Pressable
                            onPress={handleBack}
                            className="h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#0d1721]"
                        >
                            <ArrowLeft color="#FFFFFF" size={20} />
                        </Pressable>
                        <Text className="text-xl font-bold text-white">CookSmart Assistant</Text>
                        <View className="h-11 w-11" />
                    </View>

                    <View className="mb-4 overflow-hidden rounded-[30px] border border-white/10 bg-[#0d1721] px-5 pb-5 pt-5">
                        <View className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#f6b44f1f]" />
                        <View className="absolute -bottom-12 -left-8 h-24 w-24 rounded-full bg-[#00c89618]" />

                        <View className="flex-row items-start justify-between">
                            <View className="flex-1 pr-4">
                                <Text className="text-[11px] font-extrabold uppercase tracking-[1.6px] text-[#F6B44F]">
                                    Live Help
                                </Text>
                                <Text className="mt-2 text-[28px] font-black leading-9 text-white">
                                    Chat with your cooking assistant
                                </Text>
                                <Text className="mt-2 text-sm leading-6 text-[#95A8B9]">
                                    Ask what you can make from your ingredients, or get help with blurred scans,
                                    recipe search issues, login trouble, saved recipes, or planner problems.
                                </Text>
                            </View>
                            <View className="h-14 w-14 items-center justify-center rounded-[22px] bg-[#f6b44f14]">
                                <MessageCircleQuestion color="#F6B44F" size={24} />
                            </View>
                        </View>

                        <View className="mt-4 flex-row items-center justify-between rounded-[22px] border border-white/8 bg-[#08131c] px-4 py-3">
                            <View className="flex-row items-center">
                                <Sparkles color="#00C896" size={16} />
                                <Text className="ml-2 text-[12px] font-bold text-white">{supportStatus}</Text>
                            </View>
                            <Text className="text-[12px] text-[#6D8296]">
                                {availableIngredients.length ? `${availableIngredients.length} ingredients ready` : (user?.displayName || 'Guest mode')}
                            </Text>
                        </View>
                    </View>

                    <View className="mb-4">
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 12 }}>
                            {SUGGESTED_PROMPTS.map((prompt) => (
                                <Pressable
                                    key={prompt}
                                    className="mr-3 rounded-full border border-[#f6b44f30] bg-[#f6b44f14] px-4 py-3"
                                    onPress={() => sendMessage(prompt)}
                                >
                                    <Text className="text-[12px] font-bold text-[#F6B44F]">{prompt}</Text>
                                </Pressable>
                            ))}
                        </ScrollView>
                    </View>

                    <View className="min-h-[340px] rounded-[30px] border border-white/10 bg-[#0d1721] p-4">
                        {messages.map((message) => {
                            const isAssistant = message.role === 'assistant';

                            return (
                                <View key={message.id} className={`mb-3 ${isAssistant ? 'items-start' : 'items-end'}`}>
                                    <View
                                        className={`max-w-[88%] rounded-[24px] px-4 py-3 ${
                                            isAssistant
                                                ? 'border border-white/8 bg-[#08131c]'
                                                : 'bg-[#F6B44F]'
                                        }`}
                                    >
                                        <Text
                                            className={`text-[14px] leading-6 ${
                                                isAssistant ? 'text-white' : 'text-[#08131c]'
                                            }`}
                                        >
                                            {message.text}
                                        </Text>
                                    </View>
                                </View>
                            );
                        })}

                        {sending ? (
                            <View className="items-start">
                                <View className="rounded-[24px] border border-white/8 bg-[#08131c] px-4 py-3">
                                    <View className="flex-row items-center">
                                        <ActivityIndicator size="small" color="#F6B44F" />
                                        <Text className="ml-3 text-[13px] font-medium text-[#A7B7C6]">
                                            Thinking through the next step...
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        ) : null}
                    </View>

                    <View className="mt-4 rounded-[28px] border border-white/10 bg-[#0d1721] p-4">
                        <View className="flex-row items-end">
                            <TextInput
                                value={draft}
                                onChangeText={setDraft}
                                placeholder="Ask what you can cook or get app help..."
                                placeholderTextColor="#6D8296"
                                className="max-h-48 min-h-[88px] flex-1 px-3 py-3 text-[15px] text-white"
                                multiline
                                scrollEnabled
                                textAlignVertical="top"
                                onFocus={() => setTimeout(scrollToBottom, 180)}
                            />
                            <Pressable
                                onPress={() => sendMessage(draft)}
                                disabled={!draft.trim() || sending}
                                className={`ml-3 h-12 w-12 items-center justify-center rounded-2xl ${
                                    !draft.trim() || sending ? 'bg-[#1a2731]' : 'bg-[#F6B44F]'
                                }`}
                            >
                                <Send color={!draft.trim() || sending ? '#6D8296' : '#08131c'} size={18} />
                            </Pressable>
                        </View>
                        <Text className="px-3 pb-1 pt-1 text-[11px] leading-5 text-[#6D8296]">
                            Try: "What can I make from egg, onion, and tomato?"
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
