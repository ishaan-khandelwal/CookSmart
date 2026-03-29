import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Image,
    Modal,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingOverlay from '../components/LoadingOverlay';
import { useAuth } from '../context/AuthContext';
import { fetchFavorites } from '../services/api';
import { fetchRecipeDetails } from '../services/spoonacularApi';

const RECENT_SCAN_KEY = 'cooksmart:lastScan';
const RECENT_RECIPE_RESULTS_KEY = 'cooksmart:recentRecipeResults';
const PLANNER_STORAGE_PREFIX = 'cooksmart:planner:week:';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MEAL_SLOTS = [
    { key: 'breakfast', label: 'Breakfast', icon: 'sunny-outline', accent: '#F59E0B' },
    { key: 'lunch', label: 'Lunch', icon: 'partly-sunny-outline', accent: '#60A5FA' },
    { key: 'dinner', label: 'Dinner', icon: 'moon-outline', accent: '#FB7185' },
];

const STATUS_OPTIONS = [
    { key: 'planned', label: 'Planned', accent: '#F8B84E' },
    { key: 'cooked', label: 'Cooked', accent: '#22C55E' },
    { key: 'skipped', label: 'Skipped', accent: '#94A3B8' },
];

function normalizeIngredient(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\b(cup|cups|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons|oz|ounce|ounces|lb|pound|pounds|g|kg|ml|l)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function uniqueList(items) {
    return Array.from(new Set((items || []).map((item) => String(item).trim()).filter(Boolean)));
}

function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getWeekStart(date) {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    const day = result.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    result.setDate(result.getDate() + offset);
    return result;
}

function buildWeekDays() {
    const weekStart = getWeekStart(new Date());

    return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + index);

        return {
            key: formatDateKey(date),
            shortLabel: DAYS[index],
            dayNumber: String(date.getDate()),
            monthLabel: date.toLocaleDateString('en-US', { month: 'short' }),
            fullLabel: date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
            isToday: formatDateKey(date) === formatDateKey(new Date()),
        };
    });
}

function getPlannerStorageKey(weekDays) {
    return `${PLANNER_STORAGE_PREFIX}${weekDays[0]?.key || 'current'}`;
}

function createEmptyPlan(weekDays) {
    return weekDays.reduce((accumulator, day) => {
        accumulator[day.key] = {
            breakfast: null,
            lunch: null,
            dinner: null,
        };
        return accumulator;
    }, {});
}

function hydratePlan(rawPlan, weekDays) {
    const nextPlan = createEmptyPlan(weekDays);

    if (!rawPlan || typeof rawPlan !== 'object') {
        return nextPlan;
    }

    weekDays.forEach((day) => {
        const storedDay = rawPlan[day.key] || {};
        nextPlan[day.key] = {
            breakfast: storedDay.breakfast || null,
            lunch: storedDay.lunch || null,
            dinner: storedDay.dinner || null,
        };
    });

    return nextPlan;
}

function formatWeekRange(weekDays) {
    const firstDay = weekDays[0];
    const lastDay = weekDays[weekDays.length - 1];
    return `${firstDay.monthLabel} ${firstDay.dayNumber} - ${lastDay.monthLabel} ${lastDay.dayNumber}`;
}

function candidateFromFavorite(item) {
    return {
        id: item._id || `favorite-${item.recipeId || item.title}`,
        providerId: item.recipeId || '',
        provider: item.provider || 'manual',
        name: item.title,
        image: item.image || '',
        cookTime: 'Saved recipe',
        servings: null,
        vegetarian: null,
        vegan: null,
        ingredients: [],
        sourceLabel: 'Saved',
    };
}

function getDietLabel(recipe) {
    if (recipe?.vegan) {
        return { label: 'Vegan', tone: '#22C55E' };
    }
    if (recipe?.vegetarian) {
        return { label: 'Veg', tone: '#22C55E' };
    }
    return { label: 'Non-Veg', tone: '#FB7185' };
}

function getRecipeIngredientList(recipe) {
    return uniqueList(
        recipe?.ingredients?.length
            ? recipe.ingredients
            : [...(recipe?.usedIngredients || []), ...(recipe?.missingIngredients || [])],
    );
}

function computePantryMatch(ingredients, pantryIngredients) {
    const normalizedPantry = new Set((pantryIngredients || []).map(normalizeIngredient).filter(Boolean));
    const ingredientList = uniqueList(ingredients);

    if (!ingredientList.length) {
        return { score: null, have: [], missing: [] };
    }

    const have = [];
    const missing = [];

    ingredientList.forEach((ingredient) => {
        const normalizedIngredient = normalizeIngredient(ingredient);
        const matches = Array.from(normalizedPantry).some(
            (item) => normalizedIngredient.includes(item) || item.includes(normalizedIngredient),
        );

        if (matches) {
            have.push(ingredient);
        } else {
            missing.push(ingredient);
        }
    });

    return {
        score: Math.round((have.length / ingredientList.length) * 100),
        have,
        missing,
    };
}

function createPlannedMeal(recipe, sourceLabel) {
    return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        provider: recipe.provider || 'manual',
        providerId: recipe.providerId || recipe.id || '',
        name: recipe.name || recipe.title || 'Recipe',
        image: recipe.image || '',
        cookTime: recipe.readyInMinutes ? `${recipe.readyInMinutes} min` : recipe.cookTime || 'Quick meal',
        servings: recipe.servings || null,
        vegetarian: recipe.vegetarian ?? null,
        vegan: recipe.vegan ?? null,
        ingredients: getRecipeIngredientList(recipe),
        sourceLabel,
        status: 'planned',
        leftoverNextDay: false,
    };
}

function getMealMeta(meal, pantryIngredients) {
    return {
        diet: getDietLabel(meal),
        pantry: computePantryMatch(meal.ingredients, pantryIngredients),
    };
}

function getFirstEmptySlot(plan, weekDays) {
    for (const day of weekDays) {
        for (const slot of MEAL_SLOTS) {
            if (!plan[day.key]?.[slot.key]) {
                return { dayKey: day.key, mealKey: slot.key };
            }
        }
    }

    return { dayKey: weekDays[0]?.key, mealKey: 'breakfast' };
}

export default function PlannerScreen() {
    const { user } = useAuth();
    const weekDays = useMemo(() => buildWeekDays(), []);
    const storageKey = useMemo(() => getPlannerStorageKey(weekDays), [weekDays]);
    const [plan, setPlan] = useState(() => createEmptyPlan(weekDays));
    const [pantryIngredients, setPantryIngredients] = useState([]);
    const [savedCandidates, setSavedCandidates] = useState([]);
    const [recentCandidates, setRecentCandidates] = useState([]);
    const [pickerState, setPickerState] = useState(null);
    const [pickerSource, setPickerSource] = useState('recent');
    const [moveState, setMoveState] = useState(null);
    const [hydrated, setHydrated] = useState(false);
    const [loadingSources, setLoadingSources] = useState(true);
    const [selectingRecipe, setSelectingRecipe] = useState(false);
    const [notice, setNotice] = useState('');

    const intro = useRef(new Animated.Value(0)).current;

    useFocusEffect(
        useCallback(() => {
            let isMounted = true;

            const loadPlannerData = async () => {
                setLoadingSources(true);
                setNotice('');

                try {
                    const [storedPlan, storedScan, storedRecentRecipes] = await Promise.all([
                        AsyncStorage.getItem(storageKey),
                        AsyncStorage.getItem(RECENT_SCAN_KEY),
                        AsyncStorage.getItem(RECENT_RECIPE_RESULTS_KEY),
                    ]);

                    if (!isMounted) {
                        return;
                    }

                    const parsedPlan = storedPlan ? JSON.parse(storedPlan) : null;
                    const parsedScan = storedScan ? JSON.parse(storedScan) : null;
                    const parsedRecentRecipes = storedRecentRecipes ? JSON.parse(storedRecentRecipes) : [];

                    setPlan(hydratePlan(parsedPlan, weekDays));
                    setPantryIngredients(Array.isArray(parsedScan?.ingredients) ? parsedScan.ingredients : []);
                    setRecentCandidates(Array.isArray(parsedRecentRecipes) ? parsedRecentRecipes : []);
                    setHydrated(true);

                    if (user?.uid && process.env.EXPO_PUBLIC_API_URL) {
                        try {
                            const favorites = await fetchFavorites(user.uid);
                            if (isMounted) {
                                setSavedCandidates((Array.isArray(favorites) ? favorites : []).map(candidateFromFavorite));
                            }
                        } catch (error) {
                            if (isMounted) {
                                setSavedCandidates([]);
                                setNotice(error.message);
                            }
                        }
                    } else if (isMounted) {
                        setSavedCandidates([]);
                    }
                } catch {
                    if (isMounted) {
                        setPlan(createEmptyPlan(weekDays));
                        setPantryIngredients([]);
                        setRecentCandidates([]);
                        setSavedCandidates([]);
                        setHydrated(true);
                    }
                } finally {
                    if (isMounted) {
                        setLoadingSources(false);
                    }
                }
            };

            loadPlannerData();

            return () => {
                isMounted = false;
            };
        }, [storageKey, user?.uid, weekDays]),
    );

    useEffect(() => {
        Animated.timing(intro, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
        }).start();
    }, [intro]);

    useEffect(() => {
        if (!hydrated) {
            return;
        }

        AsyncStorage.setItem(storageKey, JSON.stringify(plan)).catch(() => {});
    }, [hydrated, plan, storageKey]);

    const plannerMeals = useMemo(
        () =>
            weekDays.flatMap((day) =>
                MEAL_SLOTS.map((slot) => {
                    const meal = plan[day.key]?.[slot.key];
                    return meal ? { ...meal, dayKey: day.key, dayLabel: day.shortLabel, slotKey: slot.key, slotLabel: slot.label } : null;
                }).filter(Boolean),
            ),
        [plan, weekDays],
    );

    const shoppingList = useMemo(() => {
        const map = new Map();

        plannerMeals.forEach((meal) => {
            const pantry = computePantryMatch(meal.ingredients, pantryIngredients);
            pantry.missing.forEach((ingredient) => {
                const key = normalizeIngredient(ingredient) || ingredient.toLowerCase();
                const current = map.get(key) || { id: key, label: ingredient, count: 0 };
                current.count += 1;
                map.set(key, current);
            });
        });

        return Array.from(map.values()).sort((left, right) => left.label.localeCompare(right.label));
    }, [pantryIngredients, plannerMeals]);

    const missingSummary = useMemo(() => shoppingList.slice(0, 6).map((item) => item.label).join(', '), [shoppingList]);

    const pantryReadyMeals = useMemo(
        () =>
            plannerMeals.filter((meal) => {
                const pantry = computePantryMatch(meal.ingredients, pantryIngredients);
                return pantry.score !== null && pantry.missing.length === 0;
            }).length,
        [pantryIngredients, plannerMeals],
    );

    const progressSummary = useMemo(
        () => ({
            planned: plannerMeals.filter((meal) => meal.status === 'planned').length,
            cooked: plannerMeals.filter((meal) => meal.status === 'cooked').length,
            skipped: plannerMeals.filter((meal) => meal.status === 'skipped').length,
        }),
        [plannerMeals],
    );

    const pantryCandidates = useMemo(() => {
        const merged = [...recentCandidates, ...savedCandidates];

        return merged
            .map((candidate) => ({
                ...candidate,
                pantry: computePantryMatch(getRecipeIngredientList(candidate), pantryIngredients),
            }))
            .filter((candidate) => candidate.pantry.score !== null && candidate.pantry.score > 0)
            .sort((left, right) => right.pantry.score - left.pantry.score);
    }, [pantryIngredients, recentCandidates, savedCandidates]);

    const pickerCandidates = useMemo(() => {
        if (pickerSource === 'saved') return savedCandidates;
        if (pickerSource === 'pantry') return pantryCandidates;
        return recentCandidates;
    }, [pantryCandidates, pickerSource, recentCandidates, savedCandidates]);

    const openPicker = useCallback((dayKey, mealKey, preferredSource = 'recent') => {
        setPickerState({ dayKey, mealKey });
        setPickerSource(preferredSource);
    }, []);

    const handlePlanThisWeek = useCallback(() => {
        const nextSlot = getFirstEmptySlot(plan, weekDays);
        openPicker(nextSlot.dayKey, nextSlot.mealKey, recentCandidates.length ? 'recent' : 'saved');
    }, [openPicker, plan, recentCandidates.length, weekDays]);

    const handleUseSavedRecipes = useCallback(() => {
        const nextSlot = getFirstEmptySlot(plan, weekDays);
        openPicker(nextSlot.dayKey, nextSlot.mealKey, 'saved');
    }, [openPicker, plan, weekDays]);

    const handleCookFromPantry = useCallback(() => {
        const nextSlot = getFirstEmptySlot(plan, weekDays);
        openPicker(nextSlot.dayKey, nextSlot.mealKey, 'pantry');
    }, [openPicker, plan, weekDays]);

    const handleClearWeek = useCallback(() => {
        Alert.alert('Clear this week?', 'This removes all planned meals for the current week.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear', style: 'destructive', onPress: () => setPlan(createEmptyPlan(weekDays)) },
        ]);
    }, [weekDays]);

    const handleSelectRecipe = useCallback(async (candidate) => {
        if (!pickerState) return;

        setSelectingRecipe(true);

        let nextRecipe = candidate;

        try {
            if (candidate.provider && candidate.provider !== 'manual' && (candidate.providerId || candidate.id)) {
                const details = await fetchRecipeDetails(
                    { provider: candidate.provider, id: candidate.providerId || candidate.id },
                    candidate,
                );
                nextRecipe = { ...candidate, ...details };
            }
        } catch {
            nextRecipe = candidate;
        } finally {
            setSelectingRecipe(false);
        }

        const plannedMeal = createPlannedMeal(
            nextRecipe,
            pickerSource === 'saved' ? 'Saved' : pickerSource === 'pantry' ? 'Pantry' : 'Recent',
        );

        setPlan((currentPlan) => ({
            ...currentPlan,
            [pickerState.dayKey]: {
                ...currentPlan[pickerState.dayKey],
                [pickerState.mealKey]: plannedMeal,
            },
        }));

        setPickerState(null);
    }, [pickerSource, pickerState]);

    const handleRemoveMeal = useCallback((dayKey, mealKey) => {
        setPlan((currentPlan) => ({
            ...currentPlan,
            [dayKey]: {
                ...currentPlan[dayKey],
                [mealKey]: null,
            },
        }));
    }, []);

    const handleStatusChange = useCallback((dayKey, mealKey, status) => {
        setPlan((currentPlan) => ({
            ...currentPlan,
            [dayKey]: {
                ...currentPlan[dayKey],
                [mealKey]: currentPlan[dayKey][mealKey] ? { ...currentPlan[dayKey][mealKey], status } : null,
            },
        }));
    }, []);

    const handleToggleLeftovers = useCallback((dayKey, mealKey) => {
        setPlan((currentPlan) => ({
            ...currentPlan,
            [dayKey]: {
                ...currentPlan[dayKey],
                [mealKey]: currentPlan[dayKey][mealKey]
                    ? { ...currentPlan[dayKey][mealKey], leftoverNextDay: !currentPlan[dayKey][mealKey].leftoverNextDay }
                    : null,
            },
        }));
    }, []);

    const handleMoveMeal = useCallback((targetDayKey, targetMealKey) => {
        if (!moveState) return;

        setPlan((currentPlan) => {
            const nextPlan = {
                ...currentPlan,
                [moveState.dayKey]: { ...currentPlan[moveState.dayKey] },
                [targetDayKey]: { ...currentPlan[targetDayKey] },
            };

            const sourceMeal = nextPlan[moveState.dayKey][moveState.mealKey];
            const destinationMeal = nextPlan[targetDayKey][targetMealKey];

            nextPlan[targetDayKey][targetMealKey] = sourceMeal;
            nextPlan[moveState.dayKey][moveState.mealKey] = destinationMeal || null;

            return nextPlan;
        });

        setMoveState(null);
    }, [moveState]);

    const contentOpacity = intro.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
    const contentLift = intro.interpolate({ inputRange: [0, 1], outputRange: [26, 0] });

    return (
        <View style={styles.screen}>
            <StatusBar barStyle="light-content" />
            <View style={styles.orbTop} />
            <View style={styles.orbLeft} />
            <View style={styles.orbBottom} />

            <SafeAreaView className="flex-1" edges={['top', 'left', 'right']}>
                <Animated.ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 34 }}
                    style={{ opacity: contentOpacity, transform: [{ translateY: contentLift }] }}
                >
                    <View className="px-5 pt-2.5">
                        <View style={styles.hero}>
                            <View style={styles.heroGlow} />
                            <Text className="text-[12px] font-extrabold uppercase tracking-[1.6px] text-[#F8B84E]">This Week&apos;s Plan</Text>
                            <Text className="mt-3 max-w-[280px] text-[34px] font-black leading-[40px] text-white">
                                Build a calmer week, one meal slot at a time.
                            </Text>
                            <Text className="mt-3 max-w-[290px] text-[15px] leading-6 text-white/68">
                                Plan breakfast, lunch, and dinner from saved recipes or recent matches, then let the app surface what you still need.
                            </Text>

                            <View className="mt-6 flex-row flex-wrap gap-3">
                                <View className="rounded-full border border-white/10 bg-white/7 px-3 py-2">
                                    <Text className="text-[12px] font-bold uppercase tracking-[1px] text-white/72">{formatWeekRange(weekDays)}</Text>
                                </View>
                                <View className="rounded-full border border-white/10 bg-white/7 px-3 py-2">
                                    <Text className="text-[12px] font-bold uppercase tracking-[1px] text-white/72">{plannerMeals.length} meals planned</Text>
                                </View>
                                <View className="rounded-full border border-white/10 bg-white/7 px-3 py-2">
                                    <Text className="text-[12px] font-bold uppercase tracking-[1px] text-white/72">{pantryReadyMeals} pantry-ready</Text>
                                </View>
                            </View>

                            <View className="mt-6 flex-row gap-3">
                                <View className="flex-1 rounded-[22px] bg-white/7 p-4">
                                    <Text className="text-[12px] font-bold uppercase tracking-[1px] text-white/55">Cooked</Text>
                                    <Text className="mt-3 text-[28px] font-black text-white">{progressSummary.cooked}</Text>
                                </View>
                                <View className="flex-1 rounded-[22px] bg-white/7 p-4">
                                    <Text className="text-[12px] font-bold uppercase tracking-[1px] text-white/55">Shopping items</Text>
                                    <Text className="mt-3 text-[28px] font-black text-white">{shoppingList.length}</Text>
                                </View>
                            </View>
                        </View>

                        <View className="mt-6 flex-row flex-wrap gap-3">
                            <QuickActionCard label="Plan this week" caption="Open the next empty slot" icon="calendar-outline" accent="#F59E0B" onPress={handlePlanThisWeek} />
                            <QuickActionCard label="Use saved recipes" caption="Pull from your favorites" icon="heart-outline" accent="#22C55E" onPress={handleUseSavedRecipes} />
                            <QuickActionCard label="Cook from pantry" caption="Use your scanned ingredients" icon="sparkles-outline" accent="#60A5FA" onPress={handleCookFromPantry} />
                            <QuickActionCard label="Clear week" caption="Reset the calendar" icon="trash-outline" accent="#FB7185" onPress={handleClearWeek} />
                        </View>

                        {notice ? (
                            <View className="mt-5 rounded-[22px] border border-[#f8b84e33] bg-[#f8b84e14] p-4">
                                <Text className="text-[13px] leading-5 text-white/80">{notice}</Text>
                            </View>
                        ) : null}

                        <View className="mt-6">
                            {weekDays.map((day, dayIndex) => {
                                const previousDinner = dayIndex > 0 ? plan[weekDays[dayIndex - 1].key]?.dinner : null;
                                const leftoverHint = previousDinner?.leftoverNextDay ? `${previousDinner.name} leftovers available today` : '';

                                return (
                                    <View
                                        key={day.key}
                                        className={`mb-4 overflow-hidden rounded-[28px] border p-4 ${day.isToday ? 'border-[#F59E0B]/40 bg-[#141E2B]' : 'border-white/8 bg-[#101822]'}`}
                                    >
                                        <View className="mb-4 flex-row items-start justify-between">
                                            <View>
                                                <Text className={`text-[12px] font-extrabold uppercase tracking-[1.4px] ${day.isToday ? 'text-[#F8B84E]' : 'text-white/48'}`}>
                                                    {day.shortLabel}
                                                </Text>
                                                <Text className="mt-2 text-[24px] font-black text-white">{day.fullLabel}</Text>
                                            </View>
                                            <View className={`rounded-[18px] px-4 py-3 ${day.isToday ? 'bg-[#F59E0B]' : 'bg-white/7'}`}>
                                                <Text className={`text-[22px] font-black ${day.isToday ? 'text-[#111111]' : 'text-white'}`}>{day.dayNumber}</Text>
                                            </View>
                                        </View>

                                        {leftoverHint ? (
                                            <View className="mb-4 rounded-2xl border border-[#22c55e33] bg-[#22c55e14] px-4 py-3">
                                                <Text className="text-[13px] font-semibold text-white/85">{leftoverHint}</Text>
                                            </View>
                                        ) : null}

                                        {MEAL_SLOTS.map((slot) => {
                                            const meal = plan[day.key]?.[slot.key];

                                            return meal ? (
                                                <MealCard
                                                    key={`${day.key}-${slot.key}`}
                                                    dayKey={day.key}
                                                    mealKey={slot.key}
                                                    meal={meal}
                                                    slot={slot}
                                                    pantryIngredients={pantryIngredients}
                                                    onReplace={() => openPicker(day.key, slot.key, 'recent')}
                                                    onRemove={() => handleRemoveMeal(day.key, slot.key)}
                                                    onMove={() => setMoveState({ dayKey: day.key, mealKey: slot.key, meal })}
                                                    onToggleLeftovers={() => handleToggleLeftovers(day.key, slot.key)}
                                                    onStatusChange={(status) => handleStatusChange(day.key, slot.key, status)}
                                                />
                                            ) : (
                                                <EmptySlotCard
                                                    key={`${day.key}-${slot.key}`}
                                                    slot={slot}
                                                    onPress={() => openPicker(day.key, slot.key, recentCandidates.length ? 'recent' : 'saved')}
                                                />
                                            );
                                        })}
                                    </View>
                                );
                            })}
                        </View>

                        <View className="mt-2 overflow-hidden rounded-[30px] border border-white/8 bg-[#101A26] p-5">
                            <View style={styles.shoppingGlow} />
                            <Text className="text-[12px] font-extrabold uppercase tracking-[1.4px] text-[#60A5FA]">Shopping List For This Week</Text>
                            <Text className="mt-3 text-[28px] font-black leading-9 text-white">One combined list from every planned meal.</Text>

                            {shoppingList.length ? (
                                <>
                                    <Text className="mt-3 text-[14px] leading-6 text-white/65">
                                        You still need: {missingSummary}{shoppingList.length > 6 ? ', ...' : ''}
                                    </Text>
                                    <View className="mt-5 flex-row flex-wrap">
                                        {shoppingList.map((item) => (
                                            <View key={item.id} className="mb-2 mr-2 rounded-full border border-white/10 bg-white/7 px-3 py-2">
                                                <Text className="text-[13px] font-semibold text-white">
                                                    {item.label}{item.count > 1 ? ` x${item.count}` : ''}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                </>
                            ) : plannerMeals.length ? (
                                <View className="mt-4 rounded-[22px] border border-[#22c55e33] bg-[#22c55e14] p-4">
                                    <Text className="text-[14px] font-semibold leading-6 text-white/85">
                                        Everything planned this week matches the ingredients you already scanned.
                                    </Text>
                                </View>
                            ) : (
                                <View className="mt-4 rounded-[22px] border border-white/8 bg-white/5 p-4">
                                    <Text className="text-[14px] leading-6 text-white/65">
                                        Start by planning a few meals. Your weekly missing ingredients and grocery summary will appear here automatically.
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                </Animated.ScrollView>
            </SafeAreaView>

            <RecipePickerModal
                visible={Boolean(pickerState)}
                source={pickerSource}
                candidates={pickerCandidates}
                pantryIngredients={pantryIngredients}
                loading={loadingSources}
                onClose={() => setPickerState(null)}
                onSourceChange={setPickerSource}
                onSelect={handleSelectRecipe}
            />

            <MoveMealModal
                visible={Boolean(moveState)}
                moveState={moveState}
                weekDays={weekDays}
                plan={plan}
                onClose={() => setMoveState(null)}
                onMove={handleMoveMeal}
            />

            <LoadingOverlay visible={selectingRecipe} message="Adding meal to planner..." />
        </View>
    );
}

function QuickActionCard({ label, caption, icon, accent, onPress }) {
    return (
        <Pressable className="w-[48%] rounded-[24px] border border-white/8 bg-[#101822] px-4 py-5" onPress={onPress}>
            <View className="h-12 w-12 items-center justify-center rounded-[18px]" style={{ backgroundColor: `${accent}22` }}>
                <Ionicons name={icon} size={22} color={accent} />
            </View>
            <Text className="mt-4 text-[17px] font-bold text-white">{label}</Text>
            <Text className="mt-1 text-[13px] leading-5 text-white/55">{caption}</Text>
        </Pressable>
    );
}

function EmptySlotCard({ slot, onPress }) {
    return (
        <Pressable className="mb-3 rounded-[22px] border border-dashed border-white/10 bg-white/5 px-4 py-4" onPress={onPress}>
            <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                    <View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: `${slot.accent}22` }}>
                        <Ionicons name={slot.icon} size={20} color={slot.accent} />
                    </View>
                    <View>
                        <Text className="text-[16px] font-bold text-white">{slot.label}</Text>
                        <Text className="mt-1 text-[13px] text-white/48">Tap to add a recipe</Text>
                    </View>
                </View>
                <Ionicons name="add-circle-outline" size={24} color="#FFFFFF" />
            </View>
        </Pressable>
    );
}

function MealCard({
    dayKey,
    mealKey,
    meal,
    slot,
    pantryIngredients,
    onReplace,
    onRemove,
    onMove,
    onToggleLeftovers,
    onStatusChange,
}) {
    const { diet, pantry } = getMealMeta(meal, pantryIngredients);

    return (
        <View className="mb-3 overflow-hidden rounded-[24px] border border-white/8 bg-[#172232]">
            <View className="flex-row">
                {meal.image ? (
                    <Image source={{ uri: meal.image }} className="h-[132px] w-[108px] bg-[#233146]" resizeMode="cover" />
                ) : (
                    <View className="h-[132px] w-[108px] items-center justify-center bg-[#233146]">
                        <Text className="text-[12px] font-bold uppercase tracking-[1px] text-white/55">CookSmart</Text>
                    </View>
                )}

                <View className="flex-1 px-4 py-4">
                    <View className="flex-row items-start justify-between">
                        <View className="flex-1 pr-3">
                            <View className="flex-row items-center">
                                <View className="mr-2 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: slot.accent }} />
                                <Text className="text-[12px] font-extrabold uppercase tracking-[1.2px] text-white/45">{slot.label}</Text>
                            </View>
                            <Text className="mt-2 text-[18px] font-black leading-6 text-white">{meal.name}</Text>
                        </View>

                        <View className="rounded-full px-3 py-1.5" style={{ backgroundColor: `${diet.tone}22` }}>
                            <Text className="text-[11px] font-bold" style={{ color: diet.tone }}>{diet.label}</Text>
                        </View>
                    </View>

                    <View className="mt-3 flex-row flex-wrap gap-2">
                        <View className="rounded-full bg-white/7 px-3 py-2">
                            <Text className="text-[12px] font-semibold text-white/85">{meal.cookTime}</Text>
                        </View>
                        {meal.servings ? (
                            <View className="rounded-full bg-white/7 px-3 py-2">
                                <Text className="text-[12px] font-semibold text-white/85">{meal.servings} servings</Text>
                            </View>
                        ) : null}
                        {pantry.score !== null ? (
                            <View className="rounded-full bg-white/7 px-3 py-2">
                                <Text className="text-[12px] font-semibold text-white/85">{pantry.score}% pantry match</Text>
                            </View>
                        ) : null}
                    </View>

                    <View className="mt-3 flex-row flex-wrap gap-2">
                        {STATUS_OPTIONS.map((option) => {
                            const selected = meal.status === option.key;
                            return (
                                <Pressable
                                    key={`${dayKey}-${mealKey}-${option.key}`}
                                    className="rounded-full border px-3 py-1.5"
                                    style={{
                                        borderColor: selected ? option.accent : 'rgba(255,255,255,0.12)',
                                        backgroundColor: selected ? `${option.accent}22` : 'rgba(255,255,255,0.04)',
                                    }}
                                    onPress={() => onStatusChange(option.key)}
                                >
                                    <Text className="text-[11px] font-bold" style={{ color: selected ? option.accent : '#FFFFFF' }}>
                                        {option.label}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>

                    <View className="mt-3 flex-row items-center justify-between">
                        <Pressable className={`rounded-full px-3 py-2 ${meal.leftoverNextDay ? 'bg-[#22c55e22]' : 'bg-white/7'}`} onPress={onToggleLeftovers}>
                            <Text className={`text-[11px] font-bold ${meal.leftoverNextDay ? 'text-[#22C55E]' : 'text-white/75'}`}>
                                {meal.leftoverNextDay ? 'Use leftovers next day' : 'Mark leftovers'}
                            </Text>
                        </Pressable>

                        <View className="flex-row gap-2">
                            <Pressable className="rounded-full bg-white/7 px-3 py-2" onPress={onMove}>
                                <Text className="text-[11px] font-bold text-white/80">Move</Text>
                            </Pressable>
                            <Pressable className="rounded-full bg-white/7 px-3 py-2" onPress={onReplace}>
                                <Text className="text-[11px] font-bold text-white/80">Replace</Text>
                            </Pressable>
                            <Pressable className="rounded-full bg-[#fb718522] px-3 py-2" onPress={onRemove}>
                                <Text className="text-[11px] font-bold text-[#FB7185]">Remove</Text>
                            </Pressable>
                        </View>
                    </View>

                    {pantry.missing.length ? (
                        <Text className="mt-3 text-[12px] leading-5 text-white/48">
                            Need {pantry.missing.slice(0, 3).join(', ')}{pantry.missing.length > 3 ? ', ...' : ''}
                        </Text>
                    ) : pantry.score !== null ? (
                        <Text className="mt-3 text-[12px] leading-5 text-[#22C55E]">Ready to cook from what you already have.</Text>
                    ) : (
                        <Text className="mt-3 text-[12px] leading-5 text-white/48">Ingredient detail will improve after recipe enrichment.</Text>
                    )}
                </View>
            </View>
        </View>
    );
}

function RecipePickerModal({ visible, source, candidates, pantryIngredients, loading, onClose, onSourceChange, onSelect }) {
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View className="flex-1 justify-end bg-black/55">
                <View className="max-h-[86%] rounded-t-[34px] border border-white/8 bg-[#0F1824] px-5 pb-8 pt-5">
                    <View className="mb-5 h-1.5 w-16 self-center rounded-full bg-white/15" />
                    <View className="flex-row items-start justify-between">
                        <View className="flex-1 pr-4">
                            <Text className="text-[12px] font-extrabold uppercase tracking-[1.4px] text-[#F8B84E]">Add recipe to day</Text>
                            <Text className="mt-2 text-[28px] font-black leading-9 text-white">Choose a recipe source.</Text>
                            <Text className="mt-2 text-[14px] leading-6 text-white/60">
                                Saved favorites, recent matches, or the strongest pantry-friendly options.
                            </Text>
                        </View>
                        <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-white/7" onPress={onClose}>
                            <Ionicons name="close" size={20} color="#FFFFFF" />
                        </Pressable>
                    </View>

                    <View className="mb-5 mt-5 flex-row gap-2">
                        <PickerTab label="Recent" selected={source === 'recent'} onPress={() => onSourceChange('recent')} />
                        <PickerTab label="Saved" selected={source === 'saved'} onPress={() => onSourceChange('saved')} />
                        <PickerTab label="Pantry" selected={source === 'pantry'} onPress={() => onSourceChange('pantry')} />
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        {loading ? (
                            <View className="items-center justify-center py-12">
                                <ActivityIndicator size="small" color="#F8B84E" />
                            </View>
                        ) : candidates.length ? (
                            candidates.map((candidate) => {
                                const diet = getDietLabel(candidate);
                                const pantry = computePantryMatch(getRecipeIngredientList(candidate), pantryIngredients);

                                return (
                                    <Pressable
                                        key={`${source}-${candidate.id || candidate.providerId || candidate.name}`}
                                        className="mb-3 flex-row overflow-hidden rounded-[24px] border border-white/8 bg-[#162131]"
                                        onPress={() => onSelect(candidate)}
                                    >
                                        {candidate.image ? (
                                            <Image source={{ uri: candidate.image }} className="h-[108px] w-[92px] bg-[#233146]" resizeMode="cover" />
                                        ) : (
                                            <View className="h-[108px] w-[92px] items-center justify-center bg-[#233146]">
                                                <Text className="text-[11px] font-bold uppercase tracking-[1px] text-white/50">Recipe</Text>
                                            </View>
                                        )}
                                        <View className="flex-1 px-4 py-4">
                                            <View className="flex-row items-start justify-between">
                                                <Text className="mr-3 flex-1 text-[17px] font-black leading-6 text-white">{candidate.name}</Text>
                                                <View className="rounded-full px-3 py-1.5" style={{ backgroundColor: `${diet.tone}22` }}>
                                                    <Text className="text-[11px] font-bold" style={{ color: diet.tone }}>{diet.label}</Text>
                                                </View>
                                            </View>
                                            <Text className="mt-2 text-[13px] text-white/55">
                                                {candidate.cookTime || 'Quick meal'}
                                                {candidate.servings ? ` - ${candidate.servings} servings` : ''}
                                            </Text>
                                            {pantry.score !== null ? (
                                                <Text className="mt-2 text-[13px] font-semibold text-[#F8B84E]">{pantry.score}% pantry match</Text>
                                            ) : (
                                                <Text className="mt-2 text-[13px] text-white/45">Add to planner and enrich details on save.</Text>
                                            )}
                                        </View>
                                    </Pressable>
                                );
                            })
                        ) : (
                            <View className="rounded-[24px] border border-white/8 bg-white/5 p-4">
                                <Text className="text-[14px] leading-6 text-white/65">
                                    {source === 'saved'
                                        ? 'No saved recipes yet. Save a recipe from the detail screen first.'
                                        : source === 'pantry'
                                            ? 'No recent recipes currently match your scanned pantry strongly enough.'
                                            : 'No recent recipe results stored yet. Run a recipe search first.'}
                                </Text>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

function PickerTab({ label, selected, onPress }) {
    return (
        <Pressable
            className={`rounded-full border px-4 py-2.5 ${selected ? 'border-[#F8B84E] bg-[#F8B84E]' : 'border-white/10 bg-white/6'}`}
            onPress={onPress}
        >
            <Text className={`text-[13px] font-bold ${selected ? 'text-[#111111]' : 'text-white'}`}>{label}</Text>
        </Pressable>
    );
}

function MoveMealModal({ visible, moveState, weekDays, plan, onClose, onMove }) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View className="flex-1 justify-center bg-black/55 px-5">
                <View className="rounded-[30px] border border-white/8 bg-[#0F1824] p-5">
                    <View className="flex-row items-start justify-between">
                        <View className="flex-1 pr-4">
                            <Text className="text-[12px] font-extrabold uppercase tracking-[1.4px] text-[#60A5FA]">Move meal</Text>
                            <Text className="mt-2 text-[26px] font-black leading-8 text-white">{moveState?.meal?.name || 'Choose a new slot'}</Text>
                            <Text className="mt-2 text-[14px] leading-6 text-white/60">
                                Pick another day and slot. If the target is occupied, the meals will swap places.
                            </Text>
                        </View>
                        <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-white/7" onPress={onClose}>
                            <Ionicons name="close" size={20} color="#FFFFFF" />
                        </Pressable>
                    </View>

                    <ScrollView className="mt-5 max-h-[420px]" showsVerticalScrollIndicator={false}>
                        {weekDays.map((day) => (
                            <View key={`move-${day.key}`} className="mb-3 rounded-[22px] border border-white/8 bg-white/5 p-4">
                                <Text className="text-[16px] font-bold text-white">{day.fullLabel}</Text>
                                <View className="mt-3 flex-row flex-wrap gap-2">
                                    {MEAL_SLOTS.map((slot) => {
                                        const occupiedMeal = plan[day.key]?.[slot.key];
                                        const disabled = moveState?.dayKey === day.key && moveState?.mealKey === slot.key;

                                        return (
                                            <Pressable
                                                key={`${day.key}-${slot.key}`}
                                                className={`rounded-full px-3 py-2 ${disabled ? 'bg-white/7 opacity-40' : 'bg-[#182334]'}`}
                                                onPress={() => onMove(day.key, slot.key)}
                                                disabled={disabled}
                                            >
                                                <Text className="text-[12px] font-bold text-white">
                                                    {slot.label}{occupiedMeal ? ` - ${occupiedMeal.name}` : ''}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#071018' },
    orbTop: { position: 'absolute', top: -60, right: -40, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(245, 158, 11, 0.14)' },
    orbLeft: { position: 'absolute', top: 280, left: -90, width: 210, height: 210, borderRadius: 105, backgroundColor: 'rgba(34, 197, 94, 0.12)' },
    orbBottom: { position: 'absolute', bottom: 140, right: -60, width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(96, 165, 250, 0.11)' },
    hero: { overflow: 'hidden', borderRadius: 34, padding: 24, backgroundColor: '#101A26', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    heroGlow: { position: 'absolute', top: -40, right: -30, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(248, 184, 78, 0.12)' },
    shoppingGlow: { position: 'absolute', top: -55, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(96, 165, 250, 0.1)' },
});
