import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BOTTOM_TAB_BAR_RESERVED_SPACE } from '../components/BottomTabBar';
import { useAuth } from '../context/AuthContext';
import { fetchFavorites, getCachedFavorites } from '../services/api';
import { fetchRecipeDetails } from '../services/spoonacularApi';
import { getRecipeDietLabel, getRecipeDietTone } from '../utils/recipeDiet';

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
        vegetarian: item.vegetarian ?? null,
        vegan: item.vegan ?? null,
        ingredients: [],
        sourceLabel: 'Saved',
    };
}

function getDietLabel(recipe) {
    return {
        label: getRecipeDietLabel(recipe),
        tone: getRecipeDietTone(recipe),
    };
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
        id: recipe.plannedMealId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
        enriching: Boolean(recipe.enriching),
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

                    if (isMounted) {
                        setLoadingSources(false);
                    }

                    if (user?.uid) {
                        try {
                            const cachedFavorites = await getCachedFavorites(user.uid);
                            if (isMounted && cachedFavorites.length) {
                                setSavedCandidates(cachedFavorites.map(candidateFromFavorite));
                            }

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

        AsyncStorage.setItem(storageKey, JSON.stringify(plan)).catch(() => { });
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
            .filter((candidate) => candidate.pantry.score === 100 && candidate.pantry.missing.length === 0)
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

    const handleSelectRecipe = useCallback((candidate) => {
        if (!pickerState) return;

        const targetPickerState = pickerState;
        const sourceLabel = pickerSource === 'saved'
            ? 'Saved'
            : pickerSource === 'pantry'
                ? 'Pantry'
                : pickerSource === 'manual'
                    ? 'Manual'
                    : 'Recent';
        const plannedMealId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const shouldEnrich = candidate.provider && candidate.provider !== 'manual' && (candidate.providerId || candidate.id);
        const plannedMeal = createPlannedMeal(
            { ...candidate, plannedMealId, enriching: shouldEnrich },
            sourceLabel,
        );

        setPlan((currentPlan) => ({
            ...currentPlan,
            [targetPickerState.dayKey]: {
                ...currentPlan[targetPickerState.dayKey],
                [targetPickerState.mealKey]: plannedMeal,
            },
        }));

        setPickerState(null);

        if (!shouldEnrich) {
            return;
        }

        fetchRecipeDetails(
            { provider: candidate.provider, id: candidate.providerId || candidate.id },
            candidate,
        )
            .then((details) => {
                const enrichedMeal = createPlannedMeal(
                    { ...candidate, ...details, plannedMealId, enriching: false },
                    sourceLabel,
                );

                setPlan((currentPlan) => {
                    const currentMeal = currentPlan[targetPickerState.dayKey]?.[targetPickerState.mealKey];
                    if (!currentMeal || currentMeal.id !== plannedMealId) {
                        return currentPlan;
                    }

                    return {
                        ...currentPlan,
                        [targetPickerState.dayKey]: {
                            ...currentPlan[targetPickerState.dayKey],
                            [targetPickerState.mealKey]: {
                                ...currentMeal,
                                ...enrichedMeal,
                                status: currentMeal.status,
                                leftoverNextDay: currentMeal.leftoverNextDay,
                                enriching: false,
                            },
                        },
                    };
                });
            })
            .catch(() => {
                setPlan((currentPlan) => {
                    const currentMeal = currentPlan[targetPickerState.dayKey]?.[targetPickerState.mealKey];
                    if (!currentMeal || currentMeal.id !== plannedMealId) {
                        return currentPlan;
                    }

                    return {
                        ...currentPlan,
                        [targetPickerState.dayKey]: {
                            ...currentPlan[targetPickerState.dayKey],
                            [targetPickerState.mealKey]: {
                                ...currentMeal,
                                enriching: false,
                            },
                        },
                    };
                });
            });
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
                    contentContainerStyle={{ paddingBottom: BOTTOM_TAB_BAR_RESERVED_SPACE + 24 }}
                    style={{ opacity: contentOpacity, transform: [{ translateY: contentLift }] }}
                >
                    <View style={styles.contentShell}>
                        <View style={styles.hero}>
                            <View style={styles.heroGlow} />
                            <View className="flex-row items-start justify-between">
                                <Text className="text-[12px] font-extrabold uppercase tracking-[1.6px] text-[#F8B84E]">Weekly Planner</Text>
                                <View style={styles.heroCounter}>
                                    <Text className="text-[26px] font-white text-[#08131c]">{plannerMeals.length}</Text>
                                    <Text className="mt-1 text-[11px] font-extrabold uppercase tracking-[1px] text-[#08131c]">planned</Text>
                                </View>
                            </View>
                            <Text className="mt-4 max-w-[280px] text-[34px] font-white leading-[40px] text-white">
                                {formatWeekRange(weekDays)}
                            </Text>
                            <Text className="mt-3 max-w-[300px] text-[15px] leading-6 text-[#E3EAF2]">
                                Plan breakfast, lunch, and dinner around your pantry, recent recipe finds, and saved meals in one calmer workspace.
                            </Text>

                            <View className="mt-6 flex-row flex-wrap gap-3 text-white">
                                <PlannerStat label="Pantry-ready" value={String(pantryReadyMeals)} caption="fully covered meals" />
                                <PlannerStat label="Cooked" value={String(progressSummary.cooked)} caption="already completed" />
                                <PlannerStat label="Shopping" value={String(shoppingList.length)} caption="items missing" />
                            </View>

                            <View className="mt-6 flex-row flex-wrap gap-3">
                                <PrimaryPlannerAction label="Plan Next Slot" icon="calendar-outline" accent="#F59E0B" onPress={handlePlanThisWeek} />
                                <PrimaryPlannerAction label="Cook From Pantry" icon="sparkles-outline" accent="#60A5FA" onPress={handleCookFromPantry} />
                                <SecondaryPlannerAction label="Saved Recipes" icon="heart-outline" onPress={handleUseSavedRecipes} />
                                <SecondaryPlannerAction label="Clear Week" icon="trash-outline" destructive onPress={handleClearWeek} />
                            </View>
                        </View>

                        {notice ? (
                            <View className="mt-5 rounded-[22px] border border-[#f8b84e33] bg-[#f8b84e14] p-4">
                                <Text className="text-[13px] leading-5 text-[#CBD5E1]">{notice}</Text>
                            </View>
                        ) : null}

                        <View className="mt-6">
                            {weekDays.map((day, dayIndex) => {
                                const previousDinner = dayIndex > 0 ? plan[weekDays[dayIndex - 1].key]?.dinner : null;
                                const leftoverHint = previousDinner?.leftoverNextDay ? `${previousDinner.name} leftovers available today` : '';

                                return (
                                    <View
                                        key={day.key}
                                        className={`mb-4 overflow-hidden rounded-[30px] border p-4 ${day.isToday ? 'border-[#F59E0B]/40 bg-[#131e2a]' : 'border-white/8 bg-[#101822]'}`}
                                    >
                                        <View className="mb-4 flex-row items-center justify-between">
                                            <View className="flex-1 pr-4">
                                                <View className="flex-row items-center gap-2">
                                                    <Text className={`text-[12px] font-extrabold uppercase tracking-[1.4px] ${day.isToday ? 'text-[#F8B84E]' : 'text-[#B7C3D1]'}`}>
                                                        {day.shortLabel}
                                                    </Text>
                                                    {day.isToday ? (
                                                        <View className="rounded-full bg-[#F59E0B] px-2.5 py-1">
                                                            <Text className="text-[10px] font-white uppercase tracking-[0.8px] text-[#08131c]">Today</Text>
                                                        </View>
                                                    ) : null}
                                                </View>
                                                <Text className="mt-2 text-[24px] font-white text-white">{day.fullLabel}</Text>
                                                <Text className="mt-2 text-[13px] leading-5 text-[#B7C3D1]">
                                                    {Object.values(plan[day.key] || {}).filter(Boolean).length} of {MEAL_SLOTS.length} slots filled
                                                </Text>
                                            </View>
                                            <View className={`rounded-[18px] px-4 py-3 ${day.isToday ? 'bg-[#F59E0B]' : 'bg-white/7'}`}>
                                                <Text className={`text-[22px] font-white ${day.isToday ? 'text-[#08131C]' : 'text-white'}`}>{day.dayNumber}</Text>
                                            </View>
                                        </View>

                                        {leftoverHint ? (
                                            <View className="mb-4 rounded-2xl border border-[#22c55e33] bg-[#22c55e14] px-4 py-3">
                                                <Text className="text-[13px] font-semibold text-[#D8E0EA]">{leftoverHint}</Text>
                                            </View>
                                        ) : null}

                                        <View className="gap-3">
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
                                    </View>
                                );
                            })}
                        </View>

                        <View className="mt-2 overflow-hidden rounded-[30px] border border-white/8 bg-[#101A26] p-5">
                            <View style={styles.shoppingGlow} />
                            <Text className="text-[12px] font-extrabold uppercase tracking-[1.4px] text-[#60A5FA]">Shopping List For This Week</Text>
                            <Text className="mt-3 text-[28px] font-white leading-9 text-white">One combined list from every planned meal.</Text>

                            {shoppingList.length ? (
                                <>
                                    <Text className="mt-3 text-[14px] leading-6 text-[#D1DAE5]">
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
                                    <Text className="text-[14px] font-semibold leading-6 text-[#D8E0EA]">
                                        Everything planned this week matches the ingredients you already scanned.
                                    </Text>
                                </View>
                            ) : (
                                <View className="mt-4 rounded-[22px] border border-white/8 bg-white/5 p-4">
                                    <Text className="text-[14px] leading-6 text-[#D1DAE5]">
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
        </View>
    );
}

function PlannerStat({ label, value, caption }) {
    return (
        <View className="min-w-[47%] flex-1 rounded-[22px] border border-white/10 bg-white/6 px-4 py-4">
            <Text className="text-[11px] font-extrabold uppercase tracking-[1px] text-[#B7C3D1]">{label}</Text>
            <Text className="mt-3 text-[28px] font-white text-white">{value}</Text>
            <Text className="mt-1 text-[12px] leading-5 text-[#B7C3D1]">{caption}</Text>
        </View>
    );
}

function PrimaryPlannerAction({ label, icon, accent, onPress }) {
    return (
        <Pressable className="min-w-[48%] flex-1 rounded-[24px] border border-white/10 bg-[#111c28] px-4 py-4" onPress={onPress}>
            <View className="flex-row items-center">
                <View className="mr-3 h-11 w-11 items-center justify-center rounded-[16px]" style={{ backgroundColor: `${accent}22` }}>
                    <Ionicons name={icon} size={20} color={accent} />
                </View>
                <Text className="flex-1 text-[15px] font-white text-white">{label}</Text>
            </View>
        </Pressable>
    );
}

function SecondaryPlannerAction({ label, icon, onPress, destructive = false }) {
    const tint = destructive ? '#FB7185' : '#D2D9E2';

    return (
        <Pressable className="rounded-full border border-white/10 bg-white/5 px-4 py-3" onPress={onPress}>
            <View className="flex-row items-center">
                <Ionicons name={icon} size={15} color={tint} />
                <Text className="ml-2 text-[13px] font-bold" style={{ color: tint }}>{label}</Text>
            </View>
        </Pressable>
    );
}

function EmptySlotCard({ slot, onPress }) {
    return (
        <Pressable className="rounded-[22px] border border-dashed border-white/10 bg-white/5 px-4 py-4" onPress={onPress}>
            <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                    <View className="mr-3 h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: `${slot.accent}22` }}>
                        <Ionicons name={slot.icon} size={20} color={slot.accent} />
                    </View>
                    <View>
                        <Text className="text-[16px] font-bold text-white">{slot.label}</Text>
                        <Text className="mt-1 text-[13px] text-[#B7C3D1]">Add a recipe for this slot</Text>
                    </View>
                </View>
                <View className="h-10 w-10 items-center justify-center rounded-full bg-white/6">
                    <Ionicons name="add" size={20} color="#FFFFFF" />
                </View>
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
        <View className="overflow-hidden rounded-[24px] border border-white/8 bg-[#172232]">
            <View className="p-4">
                <View className="flex-row items-start">
                    {meal.image ? (
                        <Image source={{ uri: meal.image }} className="h-[102px] w-[92px] rounded-[18px] bg-[#233146]" resizeMode="cover" />
                    ) : (
                        <View className="h-[102px] w-[92px] items-center justify-center rounded-[18px] bg-[#233146]">
                            <Text className="text-[12px] font-bold uppercase tracking-[1px] text-[#C6D0DB]">CookSmart</Text>
                        </View>
                    )}

                    <View className="ml-4 flex-1">
                        <View className="flex-row items-start justify-between">
                            <View className="flex-1 pr-3">
                                <View className="flex-row flex-wrap items-center gap-2">
                                    <View className="flex-row items-center rounded-full bg-white/6 px-2.5 py-1.5">
                                        <View className="mr-2 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: slot.accent }} />
                                        <Text className="text-[11px] font-extrabold uppercase tracking-[1px] text-[#D1DAE5]">{slot.label}</Text>
                                    </View>
                                    <Text className="text-[11px] font-semibold uppercase tracking-[0.8px] text-[#A3B0BF]">
                                        {meal.sourceLabel || 'Planner'}
                                    </Text>
                                </View>
                                <Text className="mt-3 text-[18px] font-white leading-6 text-white">{meal.name}</Text>
                            </View>

                            <View className="rounded-full px-3 py-1.5" style={{ backgroundColor: `${diet.tone}22` }}>
                                <Text className="text-[11px] font-bold" style={{ color: diet.tone }}>{diet.label}</Text>
                            </View>
                        </View>

                        <View className="mt-3 flex-row flex-wrap gap-2">
                            <View className="rounded-full bg-white/7 px-3 py-2">
                                <Text className="text-[12px] font-semibold text-[#D8E0EA]">{meal.cookTime}</Text>
                            </View>
                            {meal.servings ? (
                                <View className="rounded-full bg-white/7 px-3 py-2">
                                    <Text className="text-[12px] font-semibold text-[#D8E0EA]">{meal.servings} servings</Text>
                                </View>
                            ) : null}
                            {pantry.score !== null ? (
                                <View className="rounded-full bg-[#F8B84E]/15 px-3 py-2">
                                    <Text className="text-[12px] font-semibold text-[#F8D08B]">{pantry.score}% pantry match</Text>
                                </View>
                            ) : null}
                        </View>
                    </View>
                </View>

                <View className="mt-4 flex-row flex-wrap gap-2">
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

                <View className="mt-3 flex-row flex-wrap gap-2">
                    <Pressable className={`rounded-full px-3 py-2 ${meal.leftoverNextDay ? 'bg-[#22c55e22]' : 'bg-white/7'}`} onPress={onToggleLeftovers}>
                        <Text className={`text-[11px] font-bold ${meal.leftoverNextDay ? 'text-[#22C55E]' : 'text-[#C1CAD6]'}`}>
                            {meal.leftoverNextDay ? 'Using leftovers next day' : 'Mark leftovers'}
                        </Text>
                    </Pressable>
                    <Pressable className="rounded-full bg-white/7 px-3 py-2" onPress={onMove}>
                        <Text className="text-[11px] font-bold text-[#CBD5E1]">Move</Text>
                    </Pressable>
                    <Pressable className="rounded-full bg-white/7 px-3 py-2" onPress={onReplace}>
                        <Text className="text-[11px] font-bold text-[#CBD5E1]">Replace</Text>
                    </Pressable>
                    <Pressable className="rounded-full bg-[#fb718522] px-3 py-2" onPress={onRemove}>
                        <Text className="text-[11px] font-bold text-[#FB7185]">Remove</Text>
                    </Pressable>
                </View>

                {pantry.missing.length ? (
                    <Text className="mt-3 text-[12px] leading-5 text-[#B7C3D1]">
                        Need {pantry.missing.slice(0, 3).join(', ')}{pantry.missing.length > 3 ? ', ...' : ''}
                    </Text>
                ) : pantry.score !== null ? (
                    <Text className="mt-3 text-[12px] leading-5 text-[#22C55E]">Ready to cook from what you already have.</Text>
                ) : (
                    <Text className="mt-3 text-[12px] leading-5 text-[#B7C3D1]">Ingredient detail will improve after recipe enrichment.</Text>
                )}
                {meal.enriching ? (
                    <Text className="mt-2 text-[12px] leading-5 text-[#F8B84E]">Updating details in background...</Text>
                ) : null}
            </View>
        </View>
    );
}

function RecipePickerModal({ visible, source, candidates, pantryIngredients, loading, onClose, onSourceChange, onSelect }) {
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View className="flex-1 justify-end bg-white/55">
                <View style={styles.bottomSheet}>
                    <View className="mb-5 h-1.5 w-16 self-center rounded-full bg-white/15" />
                    <View className="flex-row items-start justify-between">
                        <View className="flex-1 pr-4">
                            <Text className="text-[12px] font-extrabold uppercase tracking-[1.4px] text-[#F8B84E]">Add recipe to day</Text>
                            <Text className="mt-2 text-[28px] font-white leading-9 text-white">Choose a recipe source.</Text>
                            <Text className="mt-2 text-[14px] leading-6 text-[#D1DAE5]">
                                Saved favorites, recent matches, or the strongest pantry-friendly options.
                            </Text>
                        </View>
                        <Pressable className="h-10 w-10 items-center justify-center rounded-full bg-white/7" onPress={onClose}>
                            <Ionicons name="close" size={20} color="#FFFFFF" />
                        </Pressable>
                    </View>

                    <View className="mb-5 mt-5 flex-row flex-wrap gap-2">
                        <PickerTab label="Recent" selected={source === 'recent'} onPress={() => onSourceChange('recent')} />
                        <PickerTab label="Saved" selected={source === 'saved'} onPress={() => onSourceChange('saved')} />
                        <PickerTab label="Pantry" selected={source === 'pantry'} onPress={() => onSourceChange('pantry')} />
                        <PickerTab label="Manual" selected={source === 'manual'} onPress={() => onSourceChange('manual')} />
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        {source === 'manual' ? (
                            <ManualAddForm onSelect={onSelect} />
                        ) : loading ? (
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
                                            <Image source={{ uri: candidate.image }} className="h-[112px] w-[94px] bg-[#233146]" resizeMode="cover" />
                                        ) : (
                                            <View className="h-[112px] w-[94px] items-center justify-center bg-[#233146]">
                                                <Text className="text-[11px] font-bold uppercase tracking-[1px] text-[#8E9CAA]">Recipe</Text>
                                            </View>
                                        )}
                                        <View className="flex-1 px-4 py-4">
                                            <View className="flex-row items-start justify-between">
                                                <View className="mr-3 flex-1">
                                                    <Text className="text-[11px] font-extrabold uppercase tracking-[1px] text-[#A3B0BF]">
                                                        {candidate.sourceLabel || (source === 'saved' ? 'Saved' : source === 'pantry' ? 'Pantry' : 'Recent')}
                                                    </Text>
                                                    <Text className="mt-2 text-[17px] font-white leading-6 text-white">{candidate.name}</Text>
                                                </View>
                                                <View className="rounded-full px-3 py-1.5" style={{ backgroundColor: `${diet.tone}22` }}>
                                                    <Text className="text-[11px] font-bold" style={{ color: diet.tone }}>{diet.label}</Text>
                                                </View>
                                            </View>
                                            <Text className="mt-2 text-[13px] text-[#CBD5E1]">
                                                {candidate.cookTime || 'Quick meal'}
                                                {candidate.servings ? ` - ${candidate.servings} servings` : ''}
                                            </Text>
                                            {pantry.score !== null ? (
                                                <Text className="mt-2 text-[13px] font-semibold text-[#F8B84E]">{pantry.score}% pantry match</Text>
                                            ) : (
                                                <Text className="mt-2 text-[13px] text-[#B7C3D1]">Add to planner and enrich details on save.</Text>
                                            )}
                                        </View>
                                    </Pressable>
                                );
                            })
                        ) : (
                            <View className="rounded-[24px] border border-white/8 bg-white/5 p-4">
                                <Text className="text-[14px] leading-6 text-[#D1DAE5]">
                                    {source === 'saved'
                                        ? 'No saved recipes yet. Save a recipe from the detail screen first.'
                                        : source === 'pantry'
                                            ? 'No recipes are 100% pantry-ready from your scanned ingredients yet.'
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
            <Text className={`text-[13px] font-bold ${selected ? 'text-[#08131C]' : 'text-white'}`}>{label}</Text>
        </Pressable>
    );
}

function MoveMealModal({ visible, moveState, weekDays, plan, onClose, onMove }) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View className="flex-1 justify-center bg-white/55 px-5">
                <View style={styles.dialogCard}>
                    <View className="flex-row items-start justify-between">
                        <View className="flex-1 pr-4">
                            <Text className="text-[12px] font-extrabold uppercase tracking-[1.4px] text-[#60A5FA]">Move meal</Text>
                            <Text className="mt-2 text-[26px] font-white leading-8 text-white">{moveState?.meal?.name || 'Choose a new slot'}</Text>
                            <Text className="mt-2 text-[14px] leading-6 text-[#D1DAE5]">
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

function ManualAddForm({ onSelect }) {
    const [title, setTitle] = useState('');
    const [image, setImage] = useState('');
    const [isVegetarian, setIsVegetarian] = useState(true);

    const handleSubmit = () => {
        if (!title.trim()) {
            Alert.alert('Required', 'Please enter a recipe title.');
            return;
        }

        onSelect({
            id: `manual-${Date.now()}`,
            provider: 'manual',
            name: title.trim(),
            image: image.trim() || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?q=80&w=426&auto=format&fit=crop',
            vegetarian: isVegetarian,
            cookTime: 'Custom meal',
            ingredients: [],
        });
    };

    return (
        <View className="rounded-[28px] border border-white/8 bg-white/5 p-5">
            <Text className="mb-2 text-xs font-bold uppercase tracking-[1px] text-[#F8B84E]">Manual meal</Text>
            <Text className="mb-4 text-[14px] leading-6 text-[#D1DAE5]">
                Add a one-off meal with an optional image link if you want the planner to hold custom meals too.
            </Text>

            <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Meal Name (e.g. Scrambled Eggs)"
                placeholderTextColor="#6B7280"
                className="mb-3 rounded-2xl border border-white/5 bg-[#0A0F16] px-4 py-3.5 text-white"
            />

            <TextInput
                value={image}
                onChangeText={setImage}
                placeholder="Image URL (Optional)"
                placeholderTextColor="#6B7280"
                className="mb-3 rounded-2xl border border-white/5 bg-[#0A0F16] px-4 py-3.5 text-white"
            />

            <View className="mb-5 flex-row items-center justify-between px-1">
                <Text className="text-sm font-semibold text-[#D8E0EA]">Dietary</Text>
                <View className="flex-row gap-2">
                    <TouchableOpacity
                        onPress={() => setIsVegetarian(true)}
                        className={`rounded-full px-4 py-2 ${isVegetarian ? 'bg-[#22C55E]' : 'bg-white/5 border border-white/10'}`}
                    >
                        <Text className={`text-[12px] font-bold ${isVegetarian ? 'text-[#08131C]' : 'text-[#D8E0EA]'}`}>Veg</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setIsVegetarian(false)}
                        className={`rounded-full px-4 py-2 ${!isVegetarian ? 'bg-[#FB7185]' : 'bg-white/5 border border-white/10'}`}
                    >
                        <Text className={`text-[12px] font-bold ${!isVegetarian ? 'text-[#08131C]' : 'text-[#D8E0EA]'}`}>Non-Veg</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <TouchableOpacity
                className={`items-center rounded-2xl px-4 py-4 ${!title.trim() ? 'bg-[#F8B84E]/40' : 'bg-[#F8B84E]'}`}
                activeOpacity={0.85}
                onPress={handleSubmit}
                disabled={!title.trim()}
            >
                <Text className="text-[15px] font-white uppercase tracking-[1px] text-[#08131C]">
                    Add to Planner
                </Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#071018' },
    contentShell: {
        width: '100%',
        alignSelf: 'center',
        paddingHorizontal: 16,
        paddingTop: 12,
    },
    orbTop: { position: 'absolute', top: -60, right: -40, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(245, 158, 11, 0.14)' },
    orbLeft: { position: 'absolute', top: 280, left: -90, width: 210, height: 210, borderRadius: 105, backgroundColor: 'rgba(34, 197, 94, 0.12)' },
    orbBottom: { position: 'absolute', bottom: 140, right: -60, width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(96, 165, 250, 0.11)' },
    hero: { overflow: 'hidden', borderRadius: 34, padding: 24, backgroundColor: '#101A26', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    heroGlow: { position: 'absolute', top: -40, right: -30, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(248, 184, 78, 0.12)' },
    heroCounter: { minWidth: 88, alignItems: 'center', borderRadius: 24, paddingHorizontal: 14, paddingVertical: 16, backgroundColor: '#F8B84E' },
    bottomSheet: {
        width: '100%',
        alignSelf: 'center',
        maxHeight: '86%',
        borderTopLeftRadius: 34,
        borderTopRightRadius: 34,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: '#0F1824',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 32,
    },
    dialogCard: {
        width: '100%',
        alignSelf: 'center',
        borderRadius: 30,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: '#0F1824',
        padding: 20,
    },
    shoppingGlow: { position: 'absolute', top: -55, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(96, 165, 250, 0.1)' },
});
