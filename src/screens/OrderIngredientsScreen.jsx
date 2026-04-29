import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Clipboard, Keyboard, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const DELIVERY_PARTNERS = [
    {
        id: 'blinkit',
        name: 'Blinkit',
        accent: '#F6C344',
        bg: '#1f1a08',
        icon: 'flash-outline',
        buildUrl: (query) => `https://blinkit.com/s/?q=${encodeURIComponent(query)}`,
    },
    {
        id: 'zepto',
        name: 'Zepto',
        accent: '#C084FC',
        bg: '#1d1027',
        icon: 'bag-handle-outline',
        buildUrl: (query) => `https://www.zeptonow.com/search?query=${encodeURIComponent(query)}`,
    },
    {
        id: 'instamart',
        name: 'Instamart',
        accent: '#FF8C42',
        bg: '#24140b',
        icon: 'bicycle-outline',
        buildUrl: (query) => `https://www.swiggy.com/instamart/search?custom_back=true&query=${encodeURIComponent(query)}`,
    },
    {
        id: 'bigbasket',
        name: 'BigBasket',
        accent: '#8BC34A',
        bg: '#14200d',
        icon: 'basket-outline',
        buildUrl: (query) => `https://www.bigbasket.com/ps/?q=${encodeURIComponent(query)}`,
    },
];

function uniqueList(items) {
    return Array.from(new Set((items || []).map((item) => String(item || '').trim()).filter(Boolean)));
}

function normalizeCartItems(missingIngredients, pantryStaples) {
    const missing = uniqueList(missingIngredients).map((item) => ({ name: item, type: 'missing' }));
    const pantry = uniqueList(pantryStaples)
        .filter((item) => !missing.some((missingItem) => missingItem.name === item))
        .map((item) => ({ name: item, type: 'pantry' }));

    return [...missing, ...pantry];
}

export default function OrderIngredientsScreen({ navigation, route }) {
    const recipeName = route.params?.recipeName || 'CookFreedom Recipe';
    const [manualItems, setManualItems] = useState([]);
    const [draftItem, setDraftItem] = useState('');
    const [selectedPartner, setSelectedPartner] = useState(DELIVERY_PARTNERS[0]);
    const inputRef = useRef(null);

    const recipeCartItems = useMemo(
        () => normalizeCartItems(route.params?.missingIngredients, route.params?.pantryStaples),
        [route.params?.missingIngredients, route.params?.pantryStaples],
    );

    const cartItems = useMemo(() => {
        const manuals = manualItems.map(name => ({ name, type: 'manual' }));
        return [...recipeCartItems, ...manuals];
    }, [recipeCartItems, manualItems]);

    const [selectedItems, setSelectedItems] = useState(() => recipeCartItems.map(item => item.name));

    useEffect(() => {
        const recipeItemNames = recipeCartItems.map(item => item.name);
        setSelectedItems((current) => Array.from(new Set([...recipeItemNames, ...current])));
    }, [recipeCartItems]);

    const selectedCount = selectedItems.length;
    const selectedQuery = selectedItems.join(', ');

    const toggleItem = (itemName) => {
        setSelectedItems((current) => (
            current.includes(itemName)
                ? current.filter((item) => item !== itemName)
                : [...current, itemName]
        ));
    };

    const selectMissingOnly = () => {
        setSelectedItems(cartItems.filter((item) => item.type === 'missing').map((item) => item.name));
    };

    const selectAllItems = () => {
        setSelectedItems(cartItems.map((item) => item.name));
    };

    const addManualItem = () => {
        const trimmed = draftItem.trim();
        if (!trimmed) {
            inputRef.current?.focus();
            return;
        }

        if (cartItems.some(item => item.name.toLowerCase() === trimmed.toLowerCase())) {
            Alert.alert('Already in list', `"${trimmed}" is already in your order list.`);
            return;
        }

        setManualItems(current => [...current, trimmed]);
        setSelectedItems(current => [...current, trimmed]);
        setDraftItem('');
        Keyboard.dismiss();
    };

    const removeManualItem = (name) => {
        setManualItems(current => current.filter(item => item !== name));
        setSelectedItems(current => current.filter(item => item !== name));
    };

    const handleCopyList = () => {
        if (!selectedItems.length) {
            Alert.alert('Empty List', 'Select at least one ingredient to copy.');
            return;
        }
        const listText = selectedItems.join('\n');
        Clipboard.setString(listText);
        Alert.alert('Copied!', 'Your shopping list has been copied to the clipboard.');
    };

    const handleSearchItem = async (itemName) => {
        const url = selectedPartner.buildUrl(itemName);
        try {
            await Linking.openURL(url);
        } catch {
            Alert.alert('Error', `Could not open ${selectedPartner.name}`);
        }
    };

    const handleOpenPartner = async (partner) => {
        if (!selectedItems.length) {
            Alert.alert('Select ingredients', 'Choose at least one ingredient before selecting a delivery partner.');
            return;
        }

        const url = partner.buildUrl(selectedQuery);

        try {
            await Linking.openURL(url);
        } catch {
            Alert.alert('Could not open partner', `CookSmart could not open ${partner.name} right now.`);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background">
            <ScrollView contentContainerClassName="px-5 pt-2.5 pb-8" showsVerticalScrollIndicator={false}>
                <View className="mb-[18px] flex-row items-center justify-between">
                    <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-card" onPress={() => navigation.goBack()}>
                        <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
                    </Pressable>
                    <Text className="text-lg font-bold text-textPrimary">Order Ingredients</Text>
                    <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-card" onPress={handleCopyList}>
                        <Ionicons name="copy-outline" size={20} color="#F6B44F" />
                    </Pressable>
                </View>

                <View className="overflow-hidden rounded-[28px] border border-white/10 bg-card px-5 py-6">
                    <View className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#f59e0b18]" />
                    <Text className="text-[11px] font-extrabold uppercase tracking-[1.6px] text-[#F6B44F]">
                        CookFreedom Cart
                    </Text>
                    <Text className="mt-3 text-[28px] font-black leading-9 text-textPrimary">
                        Build one cart, then choose a delivery partner.
                    </Text>
                    <Text className="mt-3 text-sm leading-6 text-textSecondary">
                        {recipeName} can be completed with the items below. Select everything you want in one go, then send the list to Blinkit, Zepto, Instamart, or BigBasket.
                    </Text>

                    <View className="mt-5 flex-row flex-wrap gap-3">
                        <View className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5">
                            <Text className="text-[12px] font-semibold text-textPrimary">{cartItems.length} total cart items</Text>
                        </View>
                        <View className="rounded-full border border-[#00c89633] bg-[#00c89614] px-4 py-2.5">
                            <Text className="text-[12px] font-semibold text-[#9FE6D3]">{selectedCount} selected</Text>
                        </View>
                    </View>
                </View>

                <View className="mt-5 rounded-[24px] border border-white/10 bg-card p-4">
                    <View className="mb-4 flex-row flex-wrap gap-2">
                        <Pressable className="rounded-full bg-primary px-4 py-2.5" onPress={selectAllItems}>
                            <Text className="text-sm font-bold text-background">Select All</Text>
                        </Pressable>
                        <Pressable className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5" onPress={selectMissingOnly}>
                            <Text className="text-sm font-bold text-textPrimary">Missing Only</Text>
                        </Pressable>
                    </View>

                    <View className="mb-5 flex-row items-center">
                        <TextInput
                            ref={inputRef}
                            value={draftItem}
                            onChangeText={setDraftItem}
                            placeholder="Add anything else (e.g. Milk)"
                            placeholderTextColor="#8892A4"
                            className="min-h-[48px] flex-1 rounded-xl border border-white/10 bg-[#111927] px-4 text-textPrimary"
                            autoCorrect={false}
                            returnKeyType="done"
                            onSubmitEditing={addManualItem}
                        />
                        <Pressable 
                            className="ml-3 h-[48px] items-center justify-center rounded-xl border border-primary bg-[#f6b44f14] px-5"
                            onPress={addManualItem}
                        >
                            <Text className="text-[14px] font-bold text-primary">Add</Text>
                        </Pressable>
                    </View>

                    {cartItems.length ? (
                        cartItems.map((item) => {
                            const selected = selectedItems.includes(item.name);
                            return (
                                <Pressable
                                    key={item.name}
                                    className={`mb-3 flex-row items-center justify-between rounded-2xl border px-4 py-3.5 ${
                                        selected ? 'border-primary bg-[#f6b44f14]' : 'border-white/10 bg-[#111927]'
                                    }`}
                                    onPress={() => toggleItem(item.name)}
                                >
                                    <View className="flex-1 pr-3">
                                        <Text className="text-[15px] font-bold text-textPrimary">{item.name}</Text>
                                        <Text className="mt-1 text-xs font-semibold uppercase tracking-[1px] text-textSecondary">
                                            {item.type === 'missing' ? 'Missing ingredient' : item.type === 'manual' ? 'Custom item' : 'Pantry basic'}
                                        </Text>
                                    </View>
                                    <View className="flex-row items-center">
                                        <Pressable 
                                            onPress={() => handleSearchItem(item.name)}
                                            className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-[#f6b44f14] border border-[#f6b44f22]"
                                        >
                                            <Ionicons name="search" size={16} color="#F6B44F" />
                                        </Pressable>
                                        {item.type === 'manual' && (
                                            <Pressable 
                                                onPress={() => removeManualItem(item.name)}
                                                className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-white/5"
                                            >
                                                <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
                                            </Pressable>
                                        )}
                                        <Ionicons
                                            name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                                            size={22}
                                            color={selected ? '#F6B44F' : '#7F91A3'}
                                        />
                                    </View>
                                </Pressable>
                            );
                        })
                    ) : (
                        <Text className="text-sm leading-6 text-textSecondary">
                            There are no extra items to order for this recipe.
                        </Text>
                    )}
                </View>

                <View className="mt-5 rounded-[24px] border border-white/10 bg-card p-4">
                    <Text className="text-lg font-bold text-textPrimary">Choose Delivery Partner</Text>
                    <Text className="mt-2 text-sm leading-6 text-textSecondary">
                        We will open the selected partner with your chosen items as the search/cart starter list.
                    </Text>

                    <View className="mt-4 gap-3">
                        {DELIVERY_PARTNERS.map((partner) => {
                            const isSelected = selectedPartner.id === partner.id;
                            return (
                                <Pressable
                                    key={partner.id}
                                    className={`rounded-[22px] border p-4 ${isSelected ? 'border-primary' : ''}`}
                                    style={{ 
                                        borderColor: isSelected ? partner.accent : `${partner.accent}44`, 
                                        backgroundColor: partner.bg 
                                    }}
                                    onPress={() => {
                                        setSelectedPartner(partner);
                                        handleOpenPartner(partner);
                                    }}
                                >
                                    <View className="flex-row items-center justify-between">
                                        <View className="flex-row items-center">
                                            <View className="h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: `${partner.accent}22` }}>
                                                <Ionicons name={partner.icon} size={20} color={partner.accent} />
                                            </View>
                                            <View className="ml-3">
                                                <Text className="text-base font-bold text-textPrimary">{partner.name}</Text>
                                                <Text className="mt-1 text-sm text-textSecondary">
                                                    {isSelected ? 'Active Partner' : 'Switch & Open'}
                                                </Text>
                                            </View>
                                        </View>
                                        <Ionicons name={isSelected ? 'checkmark-circle' : 'arrow-forward'} size={20} color={partner.accent} />
                                    </View>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
