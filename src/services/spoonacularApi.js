import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { DEFAULT_RECIPE_MODE, RECIPE_MODE_IDS } from '../constants/recipeModes';
import { findRealFavoriteImageFromTitle } from './favoriteImageApi';
import { generateGeminiContent, normalizeGeminiModelName } from './geminiApi';

const SPOONACULAR_BASE_URL = 'https://api.spoonacular.com';
const EDAMAM_BASE_URL = 'https://api.edamam.com';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const SPOONACULAR_QUOTA_STORAGE_KEY = 'cooksmart.spoonacularQuota';
const GEMINI_MODEL = 'gemini-2.0-flash';
const OPENROUTER_GEMINI_MODEL = 'google/gemini-2.0-flash-001';
const EDAMAM_ACCOUNT_USER = 'cooksmart-app';
const ENABLE_RECIPE_DEBUG_LOGS = false;
const OPTIONAL_PANTRY_STAPLES = [
    'salt',
    'black pepper',
    'pepper',
    'water',
    'oil',
    'olive oil',
    'vegetable oil',
    'butter',
    'ghee',
    'cumin',
    'cumin seeds',
    'ajwain',
    'turmeric',
    'turmeric powder',
    'chili powder',
    'red chili powder',
    'coriander powder',
];
const PANTRY_INGREDIENT_ALIASES = {
    flour: ['flour', 'wheat flour', 'whole wheat flour', 'atta', 'maida', 'all purpose flour'],
    potato: ['potato', 'potatoes', 'aloo'],
    onion: ['onion', 'onions', 'pyaz'],
};

function logRecipeProviderEvent(label, error) {
    if (!ENABLE_RECIPE_DEBUG_LOGS) return;
    console.log(`${label}:`, error?.message || error);
}

function getExtraConfigValue(key) {
    return (
        Constants.expoConfig?.extra?.[key] ||
        Constants.manifest2?.extra?.expoClient?.extra?.[key] ||
        ''
    );
}

function getEnvValue(key) {
    const rawValue = process.env[key] || getExtraConfigValue(key) || '';
    if (!rawValue) return '';
    return String(rawValue).trim().replace(/^['"]|['"]$/g, '').replace(/[\t\n\r]/g, '').trim();
}

function getSpoonacularApiKey() {
    return getEnvValue('EXPO_PUBLIC_SPOONACULAR_API_KEY') || getEnvValue('SPOONACULAR_API_KEY');
}

function getGeminiModel() {
    return normalizeGeminiModelName(getEnvValue('EXPO_PUBLIC_GEMINI_MODEL')) || GEMINI_MODEL;
}

function getEdamamCredentials() {
    return {
        appId: getEnvValue('EXPO_PUBLIC_EDAMAM_APP_ID') || getEnvValue('EDAMAM_APP_ID'),
        appKey: getEnvValue('EXPO_PUBLIC_EDAMAM_APP_KEY') || getEnvValue('EDAMAM_APP_KEY'),
    };
}

function sanitizeApiKey(rawValue) {
    if (!rawValue) return '';
    const apiKey = String(rawValue).trim().replace(/^['"]|['"]$/g, '').replace(/[\t\n\r]/g, '').trim();
    if (!apiKey || apiKey === 'your_key_here' || apiKey.includes('your_real_')) {
        return '';
    }
    return apiKey;
}

function getOpenRouterRecipeConfig() {
    const apiKey = sanitizeApiKey(getEnvValue('EXPO_PUBLIC_OPENROUTER_KEY')) || sanitizeApiKey(getEnvValue('EXPO_PUBLIC_ANTHROPIC_KEY'));
    return {
        apiKey: apiKey.startsWith('sk-or-v1-') ? apiKey : '',
        model: getEnvValue('EXPO_PUBLIC_OPENROUTER_MODEL') || OPENROUTER_GEMINI_MODEL,
    };
}

function stripHtml(value) {
    return String(value || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

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

function isOptionalPantryStaple(value) {
    const normalizedValue = normalizeIngredient(value);
    if (!normalizedValue) {
        return false;
    }

    return OPTIONAL_PANTRY_STAPLES.some((staple) => {
        const normalizedStaple = normalizeIngredient(staple);
        return normalizedValue === normalizedStaple || normalizedValue.includes(normalizedStaple) || normalizedStaple.includes(normalizedValue);
    });
}

function hasPantryIngredient(ingredients, aliases) {
    const normalizedIngredients = (ingredients || []).map(normalizeIngredient).filter(Boolean);
    const normalizedAliases = aliases.map(normalizeIngredient).filter(Boolean);

    return normalizedAliases.some((alias) => normalizedIngredients.some(
        (ingredient) => ingredient === alias || ingredient.includes(alias) || alias.includes(ingredient),
    ));
}

function createCookSmartRecipe({
    id,
    name,
    summary,
    cookTime,
    difficulty,
    ingredients,
    selectedIngredients,
    vegetarian = true,
    vegan = false,
    pantryStaples = [],
    instructionSteps = [],
}) {
    const ingredientMatch = buildIngredientMatch(selectedIngredients, ingredients);

    return {
        id,
        providerId: id,
        provider: 'cooksmart',
        name,
        summary,
        cookTime,
        readyInMinutes: Number.parseInt(String(cookTime).replace(/[^\d]/g, ''), 10) || null,
        difficulty,
        vegetarian,
        vegan,
        matchingCount: ingredientMatch.have.length,
        missingCount: 0,
        ingredients: uniqueList(ingredients),
        usedIngredients: ingredientMatch.have,
        pantryStaples: uniqueList([...pantryStaples, ...ingredientMatch.pantryStaples]),
        missingIngredients: [],
        instructionSteps: uniqueList(instructionSteps),
        instructions: uniqueList(instructionSteps).join('\n'),
        image: '',
        imageLabel: String(name || 'RECIPE').slice(0, 8).toUpperCase(),
    };
}

function createFlexibleCookSmartRecipe({
    id,
    name,
    summary,
    cookTime,
    difficulty,
    ingredients,
    selectedIngredients,
    vegetarian = true,
    vegan = false,
    pantryStaples = [],
    instructionSteps = [],
}) {
    const ingredientMatch = buildIngredientMatch(selectedIngredients, ingredients);

    return {
        id,
        providerId: id,
        provider: 'cooksmart',
        name,
        summary,
        cookTime,
        readyInMinutes: Number.parseInt(String(cookTime).replace(/[^\d]/g, ''), 10) || null,
        difficulty,
        vegetarian,
        vegan,
        matchingCount: ingredientMatch.have.length,
        missingCount: ingredientMatch.missing.length,
        ingredients: uniqueList(ingredients),
        usedIngredients: ingredientMatch.have,
        pantryStaples: uniqueList([...pantryStaples, ...ingredientMatch.pantryStaples]),
        missingIngredients: ingredientMatch.missing,
        instructionSteps: uniqueList(instructionSteps),
        instructions: uniqueList(instructionSteps).join('\n'),
        image: '',
        imageLabel: String(name || 'RECIPE').slice(0, 8).toUpperCase(),
    };
}

function getLocalPantryRecipes(ingredients) {
    const recipes = [];
    const hasFlour = hasPantryIngredient(ingredients, PANTRY_INGREDIENT_ALIASES.flour);
    const hasPotato = hasPantryIngredient(ingredients, PANTRY_INGREDIENT_ALIASES.potato);
    const hasOnion = hasPantryIngredient(ingredients, PANTRY_INGREDIENT_ALIASES.onion);

    if (hasFlour && hasPotato) {
        recipes.push(createCookSmartRecipe({
            id: 'cooksmart-aloo-paratha',
            name: 'Aloo Paratha',
            summary: 'A classic stuffed paratha built from potato and flour, using only common pantry basics and optional everyday spices.',
            cookTime: '30 min',
            difficulty: 'Medium',
            ingredients: hasOnion
                ? ['potato', 'flour', 'onion', 'salt', 'water', 'oil', 'cumin', 'chili powder']
                : ['potato', 'flour', 'salt', 'water', 'oil', 'cumin', 'chili powder'],
            selectedIngredients: ingredients,
            pantryStaples: ['salt', 'water', 'oil', 'cumin', 'chili powder'],
            instructionSteps: [
                'Boil the potato until soft, then mash it well in a bowl.',
                hasOnion
                    ? 'Mix the mashed potato with chopped onion, cumin, chili powder, and salt.'
                    : 'Mix the mashed potato with cumin, chili powder, and salt.',
                'Knead the flour with water, a little oil, and a pinch of salt into a soft dough.',
                'Divide the dough, fill each portion with the potato mixture, and seal it gently.',
                'Roll each stuffed dough ball into a paratha without pressing too hard.',
                'Cook on a hot pan with a little oil or ghee until both sides are golden.',
            ],
        }));
    }

    return recipes;
}

function getLocalCookFreedomRecipes(ingredients) {
    return [
        createFlexibleCookSmartRecipe({
            id: 'cooksmart-garlic-butter-pasta',
            name: 'Garlic Butter Pasta',
            summary: 'A fast, comforting pasta you can make tonight, with a few fresh add-ons if you want it restaurant-ready.',
            cookTime: '20 min',
            difficulty: 'Easy',
            ingredients: ['pasta', 'garlic', 'butter', 'parmesan', 'lemon', 'black pepper', 'salt'],
            selectedIngredients: ingredients,
            vegetarian: true,
            pantryStaples: ['salt', 'black pepper'],
            instructionSteps: [
                'Boil the pasta in salted water until al dente.',
                'Melt butter in a pan and cook the garlic until fragrant.',
                'Toss the pasta with the garlic butter and a splash of pasta water.',
                'Finish with parmesan, lemon, and black pepper before serving.',
            ],
        }),
        createFlexibleCookSmartRecipe({
            id: 'cooksmart-veggie-fried-rice',
            name: 'Veggie Fried Rice',
            summary: 'A flexible wok-style dinner that works with leftover rice and whatever crisp vegetables you can add.',
            cookTime: '25 min',
            difficulty: 'Easy',
            ingredients: ['rice', 'egg', 'carrot', 'peas', 'soy sauce', 'garlic', 'spring onion', 'oil'],
            selectedIngredients: ingredients,
            vegetarian: true,
            pantryStaples: ['oil'],
            instructionSteps: [
                'Scramble the egg lightly and set it aside.',
                'Cook garlic and vegetables in a hot pan with oil.',
                'Add cold rice and soy sauce, then toss until heated through.',
                'Fold the egg back in and finish with spring onion.',
            ],
        }),
        createFlexibleCookSmartRecipe({
            id: 'cooksmart-chicken-stir-fry',
            name: 'Garlic Chicken Stir-Fry',
            summary: 'A quick skillet dinner that still works even if you need to pick up a couple of fresh vegetables on the way home.',
            cookTime: '30 min',
            difficulty: 'Medium',
            ingredients: ['chicken', 'bell pepper', 'onion', 'soy sauce', 'garlic', 'ginger', 'oil'],
            selectedIngredients: ingredients,
            vegetarian: false,
            vegan: false,
            pantryStaples: ['oil'],
            instructionSteps: [
                'Slice the chicken into thin strips and season lightly.',
                'Stir-fry garlic, ginger, onion, and bell pepper until fragrant.',
                'Add the chicken and cook until browned and fully done.',
                'Finish with soy sauce and serve hot.',
            ],
        }),
        createFlexibleCookSmartRecipe({
            id: 'cooksmart-tomato-basil-soup',
            name: 'Tomato Basil Soup',
            summary: 'A cozy blended soup that can lean pantry-simple or be upgraded with cream and herbs.',
            cookTime: '35 min',
            difficulty: 'Easy',
            ingredients: ['tomato', 'onion', 'garlic', 'vegetable stock', 'cream', 'basil', 'olive oil'],
            selectedIngredients: ingredients,
            vegetarian: true,
            pantryStaples: ['olive oil'],
            instructionSteps: [
                'Cook onion and garlic in olive oil until soft.',
                'Add tomato and stock, then simmer until the vegetables break down.',
                'Blend until smooth and return to the pot.',
                'Finish with cream and basil before serving.',
            ],
        }),
        createFlexibleCookSmartRecipe({
            id: 'cooksmart-chickpea-curry',
            name: 'Chickpea Coconut Curry',
            summary: 'A rich pantry-friendly curry that is still worth making even if you need a few groceries to round it out.',
            cookTime: '35 min',
            difficulty: 'Medium',
            ingredients: ['chickpeas', 'onion', 'garlic', 'tomato', 'coconut milk', 'curry powder', 'rice', 'oil'],
            selectedIngredients: ingredients,
            vegetarian: true,
            vegan: true,
            pantryStaples: ['oil'],
            instructionSteps: [
                'Cook onion and garlic in oil until fragrant.',
                'Stir in curry powder, tomato, and chickpeas.',
                'Pour in coconut milk and simmer until thickened.',
                'Serve over rice once the sauce turns silky.',
            ],
        }),
    ];
}

function mergeRecipeSources(primaryRecipes, secondaryRecipes = []) {
    const seen = new Set();

    return [...primaryRecipes, ...secondaryRecipes].filter((recipe) => {
        const key = `${String(recipe?.name || '').trim().toLowerCase()}::${String(recipe?.provider || '').trim().toLowerCase()}`;
        if (!key || seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
}

async function parseError(response) {
    try {
        const payload = await response.json();
        return payload?.message || payload?.error?.message || JSON.stringify(payload);
    } catch {
        return await response.text();
    }
}

async function persistQuotaSnapshot(quota) {
    if (typeof quota?.used !== 'number') return;
    const payload = {
        ...quota,
        remaining: Math.max(0, 50 - quota.used),
        dailyLimit: 50,
        updatedAt: new Date().toISOString(),
    };
    try {
        await AsyncStorage.setItem(SPOONACULAR_QUOTA_STORAGE_KEY, JSON.stringify(payload));
    } catch { }
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) {
        const detail = await parseError(response);
        throw Object.assign(new Error(detail || 'Request failed'), {
            status: response.status,
            detail,
        });
    }
    return response.json();
}

async function spoonacularFetch(path, query = {}) {
    const apiKey = getSpoonacularApiKey();
    if (!apiKey) throw Object.assign(new Error('Missing Spoonacular API key'), { code: 'MISSING_API_KEY' });
    const params = new URLSearchParams({ ...query, apiKey });
    const url = `${SPOONACULAR_BASE_URL}${path}?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) {
        const detail = await parseError(response);
        const isQuotaError = response.status === 402 || /daily points limit|quota|limit has been reached/i.test(detail);
        if (isQuotaError) {
            await persistQuotaSnapshot({
                used: response.headers.get('X-API-Quota-Used') ? Number(response.headers.get('X-API-Quota-Used')) : 50,
            });
        }
        throw Object.assign(new Error(detail || 'Spoonacular error'), {
            status: response.status,
            provider: 'spoonacular',
            code: isQuotaError ? 'QUOTA_EXCEEDED' : response.status === 401 || response.status === 403 ? 'AUTH_ERROR' : 'API_ERROR',
        });
    }
    const data = await response.json();
    const quota = {
        used: response.headers.get('X-API-Quota-Used') ? Number(response.headers.get('X-API-Quota-Used')) : null,
    };
    await persistQuotaSnapshot(quota);
    return { data, quota };
}

function buildIngredientMatch(selectedIngredients, sourceIngredients) {
    const available = new Set((selectedIngredients || []).map(normalizeIngredient).filter(Boolean));
    const allIngredients = uniqueList(sourceIngredients);
    const have = [];
    const pantryStaples = [];
    const missing = [];
    allIngredients.forEach((ingredient) => {
        const normalizedIngredient = normalizeIngredient(ingredient);
        const matches = Array.from(available).some(
            (item) => normalizedIngredient.includes(item) || item.includes(normalizedIngredient),
        );
        if (matches) {
            have.push(ingredient);
            return;
        }

        if (isOptionalPantryStaple(ingredient)) {
            pantryStaples.push(ingredient);
            return;
        }

        missing.push(ingredient);
    });
    return { have, pantryStaples, missing };
}

function parseOpenRouterText(data) {
    const content = data?.choices?.[0]?.message?.content;

    if (typeof content === 'string') {
        return content.trim();
    }

    if (Array.isArray(content)) {
        return content
            .filter((item) => item?.type === 'text' && typeof item?.text === 'string')
            .map((item) => item.text)
            .join('\n')
            .trim();
    }

    return '';
}

function createPantryChefPrompt(ingredients) {
    return `You are a creative chef for a pantry-only cooking app.
Suggest 10 unique recipes that can be made using ONLY these ingredients already available at home: ${ingredients.join(', ')}.
You may optionally assume tiny pantry basics only: salt, pepper, water, oil, butter, or ghee.
Do NOT include any other extra ingredients, shopping items, or market additions.
Reply ONLY with a professional JSON array of objects.
Each object MUST have: id, name, summary, cookTime, difficulty, vegetarian (bool), vegan (bool), matchingCount (int), missingCount (int), ingredients (array of strings), instructionSteps (array of strings).
Set missingCount to 0 for every recipe.
Return ONLY the JSON array.`;
}

function createCookFreedomPrompt(ingredients) {
    const ingredientContext = ingredients.length
        ? `The user already has: ${ingredients.join(', ')}. Use those where helpful, but you may add other ingredients if the recipe genuinely needs them.`
        : 'No pantry ingredients were provided yet, so suggest popular, approachable recipes worth cooking this week.';

    return `You are a creative chef for a flexible cooking app.
${ingredientContext}
Suggest 10 full recipe ideas. It is okay if some recipes require extra ingredients the user does not have yet.
Reply ONLY with a professional JSON array of objects.
Each object MUST have: id, name, summary, cookTime, difficulty, vegetarian (bool), vegan (bool), matchingCount (int), missingCount (int), ingredients (array of strings), instructionSteps (array of strings).
Use complete ingredient lists for each recipe.
Return ONLY the JSON array.`;
}

function formatAiIngredient(item) {
    if (typeof item === 'string') {
        return item.trim();
    }

    if (item && typeof item === 'object') {
        const quantity = String(item.quantity || '').trim();
        const unit = String(item.unit || '').trim();
        const name = String(item.name || item.ingredient || item.title || '').trim();
        return [quantity, unit, name].filter(Boolean).join(' ').trim();
    }

    return '';
}

function normalizeAiRecipe(recipe, selectedIngredients, fallbackId) {
    const ingredientList = uniqueList((recipe?.ingredients || []).map(formatAiIngredient).filter(Boolean));
    const ingredientMatch = buildIngredientMatch(selectedIngredients, ingredientList);
    const rawCookTime = recipe?.readyInMinutes ?? recipe?.cookTime ?? recipe?.cook_time ?? null;
    const numericCookTime = Number.parseInt(String(rawCookTime || '').replace(/[^\d]/g, ''), 10);
    const readyInMinutes = Number.isFinite(numericCookTime) ? numericCookTime : null;
    const instructionSteps = uniqueList((recipe?.instructionSteps || recipe?.instructions || [])
        .flatMap((item) => Array.isArray(item) ? item : [item])
        .map((item) => String(item).trim())
        .filter(Boolean));
    const recipeId = String(recipe?.id || recipe?.name || fallbackId);

    return {
        ...recipe,
        id: recipeId,
        providerId: recipeId,
        provider: 'gemini',
        name: String(recipe?.name || `Recipe ${fallbackId}`).trim(),
        summary: stripHtml(recipe?.summary || ''),
        cookTime: readyInMinutes ? `${readyInMinutes} min` : String(recipe?.cookTime || 'Quick meal'),
        readyInMinutes,
        difficulty: String(recipe?.difficulty || (readyInMinutes > 45 ? 'Hard' : readyInMinutes > 25 ? 'Medium' : 'Easy')),
        vegetarian: Boolean(recipe?.vegetarian),
        vegan: Boolean(recipe?.vegan),
        matchingCount: Number.isFinite(Number(recipe?.matchingCount)) ? Number(recipe.matchingCount) : ingredientMatch.have.length,
        missingCount: Number.isFinite(Number(recipe?.missingCount)) ? Number(recipe.missingCount) : ingredientMatch.missing.length,
        ingredients: ingredientList,
        usedIngredients: ingredientMatch.have,
        pantryStaples: ingredientMatch.pantryStaples,
        missingIngredients: ingredientMatch.missing,
        instructionSteps,
        instructions: instructionSteps.join('\n'),
        image: String(recipe?.image || '').trim(),
        imageLabel: String(recipe?.name || 'RECIPE').slice(0, 8).toUpperCase(),
    };
}

function createRecipeImageFallback(title) {
    const safeTitle = String(title || 'CookSmart Recipe').replace(/\s+/g, ' ').trim() || 'CookSmart Recipe';
    return `https://placehold.co/1200x900/0d1721/F6B44F.png?text=${encodeURIComponent(safeTitle)}`;
}

async function attachRecipeImages(recipes) {
    if (!Array.isArray(recipes) || !recipes.length) {
        return [];
    }

    return Promise.all(recipes.map(async (recipe) => {
        if (String(recipe?.image || '').trim()) {
            return recipe;
        }

        try {
            const realImage = await findRealFavoriteImageFromTitle(recipe?.name);
            if (realImage) {
                return {
                    ...recipe,
                    image: realImage,
                };
            }
        } catch {
            // Fall through to a deterministic placeholder if image lookup fails.
        }

        return {
            ...recipe,
            image: createRecipeImageFallback(recipe?.name),
        };
    }));
}

function mapSpoonacularSummary(recipe) {
    const pantryStaples = (recipe.missedIngredients || [])
        .map((ingredient) => ingredient.original || ingredient.name)
        .filter((ingredient) => isOptionalPantryStaple(ingredient));
    const blockingMissing = (recipe.missedIngredients || [])
        .map((ingredient) => ingredient.original || ingredient.name)
        .filter((ingredient) => !isOptionalPantryStaple(ingredient));

    return {
        id: String(recipe.id),
        providerId: String(recipe.id),
        provider: 'spoonacular',
        name: recipe.title,
        image: recipe.image || '',
        imageLabel: String(recipe.title || 'RECIPE').slice(0, 8).toUpperCase(),
        cookTime: recipe.readyInMinutes ? `${recipe.readyInMinutes} min` : 'Quick meal',
        difficulty: recipe.readyInMinutes > 45 ? 'Hard' : recipe.readyInMinutes > 25 ? 'Medium' : 'Easy',
        matchingCount: recipe.usedIngredientCount ?? 0,
        missingCount: blockingMissing.length,
        likes: recipe.likes ?? 0,
        summary: stripHtml(recipe.summary),
        vegetarian: recipe.vegetarian || null,
        vegan: recipe.vegan || null,
        usedIngredients: (recipe.usedIngredients || []).map(i => i.original || i.name),
        pantryStaples,
        missingIngredients: blockingMissing,
    };
}

async function searchGeminiRecipes(ingredients, mode = DEFAULT_RECIPE_MODE) {
    const geminiKey = getEnvValue('EXPO_PUBLIC_GEMINI_KEY');
    if (!geminiKey) throw new Error('Missing Gemini Key');
    const prompt = mode === RECIPE_MODE_IDS.COOK_FREEDOM ? createCookFreedomPrompt(ingredients) : createPantryChefPrompt(ingredients);

    const { data: result } = await generateGeminiContent({
        apiKey: geminiKey,
        preferredModel: getGeminiModel(),
        body: {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 2000 },
        },
    });
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

    try {
        const jsonMatch = rawText.match(/\[[\s\S]*\]/);
        const recipes = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
        return {
            provider: 'gemini',
            recipes: recipes.map((r, index) => normalizeAiRecipe(r, ingredients, index + 1)),
            quota: null,
        };
    } catch {
        throw new Error('Could not parse Gemini JSON output');
    }
}

async function searchOpenRouterGeminiRecipes(ingredients, mode = DEFAULT_RECIPE_MODE) {
    const { apiKey, model } = getOpenRouterRecipeConfig();
    if (!apiKey) {
        throw Object.assign(new Error('Missing OpenRouter API key'), { code: 'MISSING_API_KEY', provider: 'openrouter' });
    }
    const prompt = mode === RECIPE_MODE_IDS.COOK_FREEDOM ? createCookFreedomPrompt(ingredients) : createPantryChefPrompt(ingredients);

    const data = await fetchJson(OPENROUTER_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://cooksmart.local',
            'X-Title': 'CookSmart',
        },
        body: JSON.stringify({
            model,
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.7,
            max_tokens: 2000,
        }),
    });

    const rawText = parseOpenRouterText(data);

    try {
        const jsonMatch = rawText.match(/\[[\s\S]*\]/);
        const recipes = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
        return {
            provider: 'gemini',
            recipes: recipes.map((r, index) => ({
                ...normalizeAiRecipe(r, ingredients, index + 1),
                providerRoute: 'openrouter',
            })),
            quota: null,
        };
    } catch {
        throw new Error('Could not parse OpenRouter Gemini JSON output');
    }
}

function mapEdamamRecipe(recipe, selectedIngredients) {
    const ingredients = uniqueList(recipe?.ingredientLines || []);
    const ingredientMatch = buildIngredientMatch(selectedIngredients, ingredients);
    const totalTime = Number(recipe?.totalTime) || 0;
    const healthLabels = Array.isArray(recipe?.healthLabels) ? recipe.healthLabels : [];
    const cuisineLabel = Array.isArray(recipe?.cuisineType) ? recipe.cuisineType[0] : '';
    const dishLabel = Array.isArray(recipe?.dishType) ? recipe.dishType[0] : '';
    const summary = [
        cuisineLabel ? `${String(cuisineLabel).replace(/^\w/, (char) => char.toUpperCase())} recipe` : 'Web recipe',
        dishLabel ? `for ${dishLabel.replace(/-/g, ' ')}` : '',
        recipe?.source ? `from ${recipe.source}` : '',
    ].filter(Boolean).join(' ');

    return {
        id: String(recipe?.uri || recipe?.url || recipe?.label),
        providerId: String(recipe?.uri || recipe?.url || recipe?.label),
        provider: 'edamam',
        name: recipe?.label || 'Recipe',
        image: recipe?.image || '',
        imageLabel: String(recipe?.label || 'RECIPE').slice(0, 8).toUpperCase(),
        cookTime: totalTime ? `${totalTime} min` : 'Source recipe',
        readyInMinutes: totalTime || null,
        difficulty: totalTime > 45 ? 'Hard' : totalTime > 25 ? 'Medium' : 'Easy',
        matchingCount: ingredientMatch.have.length,
        missingCount: ingredientMatch.missing.length,
        summary,
        vegetarian: healthLabels.includes('Vegetarian'),
        vegan: healthLabels.includes('Vegan'),
        ingredients,
        usedIngredients: ingredientMatch.have,
        pantryStaples: ingredientMatch.pantryStaples,
        missingIngredients: ingredientMatch.missing,
        instructionSteps: [],
        instructions: 'Open the source link for the full step-by-step method.',
        sourceUrl: recipe?.url || '',
        servings: recipe?.yield || null,
    };
}

async function searchEdamamRecipes(ingredients) {
    const { appId, appKey } = getEdamamCredentials();
    if (!appId || !appKey) {
        throw Object.assign(new Error('Missing Edamam credentials'), { code: 'MISSING_API_KEY', provider: 'edamam' });
    }

    const params = new URLSearchParams({
        type: 'public',
        q: ingredients.slice(0, 5).join(' '),
        app_id: appId,
        app_key: appKey,
    });
    const data = await fetchJson(`${EDAMAM_BASE_URL}/api/recipes/v2?${params.toString()}`, {
        headers: {
            'Edamam-Account-User': EDAMAM_ACCOUNT_USER,
        },
    });

    return {
        provider: 'edamam',
        recipes: (data?.hits || []).map((item) => mapEdamamRecipe(item?.recipe, ingredients)),
        quota: null,
    };
}

async function searchSpoonacularRecipes(ingredients) {
    const { data, quota } = await spoonacularFetch('/recipes/findByIngredients', {
        ingredients: ingredients.join(','),
        number: '12',
        ranking: '2',
        ignorePantry: 'true',
    });
    return {
        provider: 'spoonacular',
        recipes: (data || []).map(mapSpoonacularSummary),
        quota: { ...quota, remaining: Math.max(0, 50 - (quota.used || 0)), dailyLimit: 50 },
    };
}

function keepPantryReadyRecipes(result, ingredients) {
    const pantryReadyRecipes = (result?.recipes || [])
        .map((recipe) => {
            if (Array.isArray(recipe?.ingredients) && (!Array.isArray(recipe?.usedIngredients) || !Array.isArray(recipe?.missingIngredients))) {
                const ingredientMatch = buildIngredientMatch(ingredients, recipe.ingredients);
                return {
                    ...recipe,
                    matchingCount: ingredientMatch.have.length,
                    pantryStaples: ingredientMatch.pantryStaples,
                    missingIngredients: ingredientMatch.missing,
                    missingCount: ingredientMatch.missing.length,
                    usedIngredients: ingredientMatch.have,
                };
            }

            return {
                ...recipe,
                pantryStaples: uniqueList(recipe?.pantryStaples || []),
                missingIngredients: uniqueList(recipe?.missingIngredients || []).filter((ingredient) => !isOptionalPantryStaple(ingredient)),
            };
        })
        .map((recipe) => ({
            ...recipe,
            missingCount: uniqueList(recipe?.missingIngredients || []).length,
        }))
        .filter((recipe) => recipe.missingCount === 0)
        .sort((left, right) => (right.matchingCount || 0) - (left.matchingCount || 0));

    return {
        ...result,
        recipes: pantryReadyRecipes,
        notice: pantryReadyRecipes.length
            ? 'Showing only recipes you can cook with your current ingredients at home.'
            : '',
    };
}

function prepareCookFreedomRecipes(result, ingredients) {
    const flexibleRecipes = (result?.recipes || [])
        .map((recipe) => {
            if (Array.isArray(recipe?.ingredients)) {
                const ingredientMatch = buildIngredientMatch(ingredients, recipe.ingredients);
                const missingIngredients = uniqueList(
                    (Array.isArray(recipe?.missingIngredients) && recipe.missingIngredients.length
                        ? recipe.missingIngredients
                        : ingredientMatch.missing)
                        .filter((ingredient) => !isOptionalPantryStaple(ingredient)),
                );

                return {
                    ...recipe,
                    matchingCount: ingredientMatch.have.length,
                    usedIngredients: uniqueList(recipe?.usedIngredients?.length ? recipe.usedIngredients : ingredientMatch.have),
                    pantryStaples: uniqueList([...(recipe?.pantryStaples || []), ...ingredientMatch.pantryStaples]),
                    missingIngredients,
                    missingCount: missingIngredients.length,
                };
            }

            const missingIngredients = uniqueList((recipe?.missingIngredients || []).filter((ingredient) => !isOptionalPantryStaple(ingredient)));

            return {
                ...recipe,
                usedIngredients: uniqueList(recipe?.usedIngredients || []),
                pantryStaples: uniqueList(recipe?.pantryStaples || []),
                missingIngredients,
                missingCount: missingIngredients.length,
            };
        })
        .sort((left, right) => {
            const matchDifference = (right.matchingCount || 0) - (left.matchingCount || 0);
            if (matchDifference !== 0) {
                return matchDifference;
            }

            return (left.missingCount || 0) - (right.missingCount || 0);
        });

    return {
        ...result,
        recipes: flexibleRecipes,
        notice: ingredients.length
            ? 'Showing full recipe ideas, including dishes that may need a few extra ingredients.'
            : 'Showing flexible recipe ideas first. Add ingredients later or order what you need.',
    };
}

export async function getStoredSpoonacularQuota() {
    try {
        const rawValue = await AsyncStorage.getItem(SPOONACULAR_QUOTA_STORAGE_KEY);
        return rawValue ? JSON.parse(rawValue) : null;
    } catch {
        return null;
    }
}

export async function fetchRecipesByIngredients(ingredients, options = {}) {
    const mode = options?.mode === RECIPE_MODE_IDS.COOK_FREEDOM ? RECIPE_MODE_IDS.COOK_FREEDOM : DEFAULT_RECIPE_MODE;
    const normalized = Array.from(new Set((ingredients || []).map(i => String(i).trim().toLowerCase()).filter(Boolean)));
    if (!normalized.length && mode !== RECIPE_MODE_IDS.COOK_FREEDOM) return { recipes: [], quota: null, provider: null };
    const localPantryRecipes = getLocalPantryRecipes(normalized);
    const localCookFreedomRecipes = getLocalCookFreedomRecipes(normalized);

    if (mode === RECIPE_MODE_IDS.COOK_FREEDOM) {
        try {
            const geminiKey = getEnvValue('EXPO_PUBLIC_GEMINI_KEY');
            if (geminiKey) {
                const result = prepareCookFreedomRecipes(await searchGeminiRecipes(normalized, mode), normalized);
                const mergedRecipes = mergeRecipeSources(result.recipes, localCookFreedomRecipes);
                if (mergedRecipes.length) {
                    return {
                        ...result,
                        provider: mergedRecipes[0]?.provider || result.provider,
                        recipes: await attachRecipeImages(mergedRecipes),
                    };
                }
            }
        } catch (error) {
            logRecipeProviderEvent('Gemini Recipe Search Failed', error);
            const isRateLimited = error?.status === 429 || /too many requests|rate limit|resource exhausted/i.test(String(error?.message || ''));
            if (isRateLimited) {
                try {
                    const result = prepareCookFreedomRecipes(await searchOpenRouterGeminiRecipes(normalized, mode), normalized);
                    const mergedRecipes = mergeRecipeSources(result.recipes, localCookFreedomRecipes);
                    if (mergedRecipes.length) {
                        return {
                            ...result,
                            provider: mergedRecipes[0]?.provider || result.provider,
                            recipes: await attachRecipeImages(mergedRecipes),
                        };
                    }
                } catch (openRouterError) {
                    logRecipeProviderEvent('OpenRouter Gemini Failed', openRouterError);
                }
            }
        }

        if (normalized.length) {
            try {
                const spoonacularResult = prepareCookFreedomRecipes(await searchSpoonacularRecipes(normalized), normalized);
                const mergedRecipes = mergeRecipeSources(spoonacularResult.recipes, localCookFreedomRecipes);
                if (mergedRecipes.length) {
                    return {
                        ...spoonacularResult,
                        provider: mergedRecipes[0]?.provider || spoonacularResult.provider,
                        recipes: await attachRecipeImages(mergedRecipes),
                    };
                }
            } catch (error) {
                logRecipeProviderEvent('Spoonacular Failed', error);
            }

            try {
                const edamamResult = prepareCookFreedomRecipes(await searchEdamamRecipes(normalized), normalized);
                const mergedRecipes = mergeRecipeSources(edamamResult.recipes, localCookFreedomRecipes);
                if (mergedRecipes.length) {
                    return {
                        ...edamamResult,
                        provider: mergedRecipes[0]?.provider || edamamResult.provider,
                        recipes: await attachRecipeImages(mergedRecipes),
                    };
                }
            } catch (error) {
                logRecipeProviderEvent('Edamam Failed', error);
            }
        }

        return {
            provider: localCookFreedomRecipes[0]?.provider || null,
            quota: null,
            notice: normalized.length
                ? 'Showing full recipe ideas, including dishes that may need a few extra ingredients.'
                : 'Showing flexible recipe ideas first. Add ingredients later or order what you need.',
            recipes: await attachRecipeImages(localCookFreedomRecipes),
        };
    }

    try {
        const geminiKey = getEnvValue('EXPO_PUBLIC_GEMINI_KEY');
        if (geminiKey) {
            const result = keepPantryReadyRecipes(await searchGeminiRecipes(normalized, mode), normalized);
            const mergedRecipes = mergeRecipeSources(localPantryRecipes, result.recipes);
            if (mergedRecipes.length) {
                return {
                    ...result,
                    provider: mergedRecipes[0]?.provider || result.provider,
                    recipes: await attachRecipeImages(mergedRecipes),
                };
            }
        }
    } catch (error) {
        logRecipeProviderEvent('Gemini Recipe Search Failed', error);
        const isRateLimited = error?.status === 429 || /too many requests|rate limit|resource exhausted/i.test(String(error?.message || ''));
        if (isRateLimited) {
            try {
                const result = keepPantryReadyRecipes(await searchOpenRouterGeminiRecipes(normalized, mode), normalized);
                const mergedRecipes = mergeRecipeSources(localPantryRecipes, result.recipes);
                if (mergedRecipes.length) {
                    return {
                        ...result,
                        provider: mergedRecipes[0]?.provider || result.provider,
                        recipes: await attachRecipeImages(mergedRecipes),
                    };
                }
            } catch (openRouterError) {
                logRecipeProviderEvent('OpenRouter Gemini Failed', openRouterError);
            }
        }
    }

    try {
        const spoonacularResult = keepPantryReadyRecipes(await searchSpoonacularRecipes(normalized), normalized);
        const mergedRecipes = mergeRecipeSources(localPantryRecipes, spoonacularResult.recipes);
        if (mergedRecipes.length) {
            return {
                ...spoonacularResult,
                provider: mergedRecipes[0]?.provider || spoonacularResult.provider,
                recipes: await attachRecipeImages(mergedRecipes),
            };
        }
    } catch (e) {
        logRecipeProviderEvent('Spoonacular Failed', e);
    }

    try {
        const edamamResult = keepPantryReadyRecipes(await searchEdamamRecipes(normalized), normalized);
        const mergedRecipes = mergeRecipeSources(localPantryRecipes, edamamResult.recipes);
        if (mergedRecipes.length) {
            return {
                ...edamamResult,
                provider: mergedRecipes[0]?.provider || edamamResult.provider,
                recipes: await attachRecipeImages(mergedRecipes),
            };
        }
    } catch (error) {
        logRecipeProviderEvent('Edamam Failed', error);
    }

    return {
        provider: localPantryRecipes[0]?.provider || null,
        quota: null,
        notice: '',
        recipes: await attachRecipeImages(localPantryRecipes),
    };
}

export async function fetchRecipeDetails(recipeRef, initialRecipe = null) {
    const provider = recipeRef?.provider || initialRecipe?.provider || 'spoonacular';
    const providerId = recipeRef?.id || recipeRef?.providerId || initialRecipe?.providerId || initialRecipe?.id;

    if (provider === 'gemini' && initialRecipe) {
        return {
            ...initialRecipe,
            provider: 'gemini',
            image: initialRecipe.image || createRecipeImageFallback(initialRecipe.name),
            instructions: initialRecipe.instructions || (initialRecipe.instructionSteps || []).join('\n'),
        };
    }

    if (provider === 'edamam' && initialRecipe) {
        return {
            ...initialRecipe,
            provider: 'edamam',
            image: initialRecipe.image || createRecipeImageFallback(initialRecipe.name),
            instructions: initialRecipe.instructions || 'Open the source link for the full step-by-step method.',
        };
    }

    if (provider === 'spoonacular') {
        const { data } = await spoonacularFetch(`/recipes/${providerId}/information`, { includeNutrition: 'false' });
        const recipeDetails = {
            ...mapSpoonacularSummary(data),
            instructions: stripHtml(data.instructions),
            instructionSteps: (data.analyzedInstructions || []).flatMap(g => g.steps || []).map(s => s.step),
            ingredients: (data.extendedIngredients || []).map(i => i.original),
        };

        return {
            ...recipeDetails,
            image: recipeDetails.image || createRecipeImageFallback(recipeDetails.name),
        };
    }

    if (!initialRecipe) {
        return initialRecipe;
    }

    return {
        ...initialRecipe,
        image: initialRecipe.image || createRecipeImageFallback(initialRecipe.name),
    };
}
