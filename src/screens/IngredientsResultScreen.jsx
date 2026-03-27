import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import {
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import IngredientChip from '../components/IngredientChip';

function normalizeIngredients(list) {
    return Array.from(
        new Set(
            list
                .map((item) => String(item).trim().toLowerCase())
                .filter(Boolean),
        ),
    );
}

export default function IngredientsResultScreen({ navigation, route }) {
    const { ingredients = [], photoUri, scannerError } = route.params ?? {};
    const [items, setItems] = useState(() => normalizeIngredients(ingredients));
    const [draftIngredient, setDraftIngredient] = useState('');
    const inputRef = useRef(null);
    const hasIngredients = items.length > 0;

    const emptyStateMessage = useMemo(
        () => 'Nothing found, try better lighting or spread the ingredients out a little more.',
        [],
    );

    const removeIngredient = (ingredient) => {
        setItems((current) => current.filter((item) => item !== ingredient));
    };

    const addIngredient = () => {
        const trimmed = draftIngredient.trim().toLowerCase();
        if (!trimmed) {
            inputRef.current?.focus();
            return;
        }

        setItems((current) => normalizeIngredients([...current, trimmed]));
        setDraftIngredient('');
    };

    const handleFindRecipes = async () => {
        if (!items.length) {
            return;
        }

        navigation.navigate('RecipeResults', { ingredients: items });
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            <KeyboardAvoidingView
                className="flex-1"
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView contentContainerClassName="px-5 pt-2.5 pb-6" showsVerticalScrollIndicator={false}>
                    <View className="mb-[18px] flex-row items-center justify-between">
                        <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-card" onPress={() => navigation.goBack()}>
                            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
                        </Pressable>
                        <Text className="text-xl font-bold text-textPrimary">Detected Ingredients</Text>
                        <View className="h-10 w-10" />
                    </View>

                    {photoUri ? <Image source={{ uri: photoUri }} className="mb-[22px] h-[220px] w-full rounded-[20px]" /> : null}

                    {scannerError ? (
                        <View className="mb-[18px] flex-row items-start rounded-2xl border border-[#00c89638] bg-[#00c8961f] p-3.5">
                            <Ionicons name="warning-outline" size={18} color="#00C896" />
                            <Text className="ml-2.5 flex-1 text-sm leading-5 text-textPrimary">{scannerError}</Text>
                        </View>
                    ) : null}

                    {hasIngredients ? (
                        <>
                            <Text className="mb-3.5 text-base font-bold text-textPrimary">Edit your ingredient list</Text>
                            <View className="mb-7 flex-row flex-wrap">
                                {items.map((ingredient, index) => (
                                    <IngredientChip
                                        key={ingredient}
                                        label={ingredient}
                                        delay={index * 90}
                                        onRemove={() => removeIngredient(ingredient)}
                                    />
                                ))}
                            </View>
                        </>
                    ) : (
                        <View className="mb-7 items-center rounded-3xl bg-card p-6">
                            <View className="mb-4 h-[74px] w-[74px] items-center justify-center rounded-full bg-[#00c8961f]">
                                <Ionicons name="nutrition-outline" size={36} color="#00C896" />
                            </View>
                            <Text className="mb-2 text-xl font-bold text-textPrimary">Nothing found</Text>
                            <Text className="text-center text-sm leading-5 text-textSecondary">{emptyStateMessage}</Text>
                        </View>
                    )}

                    <View className="mb-6">
                        <Text className="mb-3.5 text-base font-bold text-textPrimary">Add more</Text>
                        <View className="flex-row items-center">
                            <TextInput
                                ref={inputRef}
                                value={draftIngredient}
                                onChangeText={setDraftIngredient}
                                placeholder="Add an ingredient"
                                placeholderTextColor="#8892A4"
                                className="min-h-[52px] flex-1 rounded-2xl border border-white/10 bg-card px-4 text-textPrimary"
                                autoCapitalize="none"
                                autoCorrect={false}
                                returnKeyType="done"
                                onSubmitEditing={addIngredient}
                            />
                            <Pressable className="ml-3 min-h-[52px] items-center justify-center rounded-2xl border border-primary bg-[#00c8961f] px-[18px]" onPress={addIngredient}>
                                <Text className="text-[15px] font-bold text-primary">+ Add</Text>
                            </Pressable>
                        </View>
                    </View>
                </ScrollView>

                <View className="px-5 pb-5">
                    <Pressable
                        className={`min-h-[54px] items-center justify-center rounded-[18px] bg-primary ${!items.length ? 'opacity-50' : ''}`}
                        onPress={handleFindRecipes}
                        disabled={!items.length}
                    >
                        <Text className="text-base font-bold text-background">
                            Find Recipes
                        </Text>
                    </Pressable>
                    <Pressable className="mt-4 items-center justify-center" onPress={() => navigation.goBack()}>
                        <Text className="text-[15px] font-semibold text-textSecondary">Scan Again</Text>
                    </Pressable>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
