import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
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
        imageLabel: String(recipe?.name || 'RECIPE').slice(0, 8).toUpperCase(),
    };
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

async function searchGeminiRecipes(ingredients) {
    const geminiKey = getEnvValue('EXPO_PUBLIC_GEMINI_KEY');
    if (!geminiKey) throw new Error('Missing Gemini Key');

    const prompt = `You are a creative chef for a pantry-only cooking app.
Suggest 10 unique recipes that can be made using ONLY these ingredients already available at home: ${ingredients.join(', ')}.
You may optionally assume tiny pantry basics only: salt, pepper, water, oil, butter, or ghee.
Do NOT include any other extra ingredients, shopping items, or market additions.
Reply ONLY with a professional JSON array of objects.
Each object MUST have: id, name, summary, cookTime, difficulty, vegetarian (bool), vegan (bool), matchingCount (int), missingCount (int), ingredients (array of strings), instructionSteps (array of strings).
Set missingCount to 0 for every recipe.
Return ONLY the JSON array.`;

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

async function searchOpenRouterGeminiRecipes(ingredients) {
    const { apiKey, model } = getOpenRouterRecipeConfig();
    if (!apiKey) {
        throw Object.assign(new Error('Missing OpenRouter API key'), { code: 'MISSING_API_KEY', provider: 'openrouter' });
    }

    const prompt = `You are a creative chef for a pantry-only cooking app.
Suggest 10 unique recipes that can be made using ONLY these ingredients already available at home: ${ingredients.join(', ')}.
You may optionally assume tiny pantry basics only: salt, pepper, water, oil, butter, or ghee.
Do NOT include any other extra ingredients, shopping items, or market additions.
Reply ONLY with a professional JSON array of objects.
Each object MUST have: id, name, summary, cookTime, difficulty, vegetarian (bool), vegan (bool), matchingCount (int), missingCount (int), ingredients (array of strings), instructionSteps (array of strings).
Set missingCount to 0 for every recipe.
Return ONLY the JSON array.`;

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
        cookTime: totalTime ? `${totalTime} min` : 'Recipe from the web',
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

export async function getStoredSpoonacularQuota() {
    try {
        const rawValue = await AsyncStorage.getItem(SPOONACULAR_QUOTA_STORAGE_KEY);
        return rawValue ? JSON.parse(rawValue) : null;
    } catch {
        return null;
    }
}

export async function fetchRecipesByIngredients(ingredients) {
    const normalized = Array.from(new Set((ingredients || []).map(i => String(i).trim().toLowerCase()).filter(Boolean)));
    if (!normalized.length) return { recipes: [], quota: null, provider: null };
    const localPantryRecipes = getLocalPantryRecipes(normalized);

    try {
        const geminiKey = getEnvValue('EXPO_PUBLIC_GEMINI_KEY');
        if (geminiKey) {
            const result = keepPantryReadyRecipes(await searchGeminiRecipes(normalized), normalized);
            const mergedRecipes = mergeRecipeSources(localPantryRecipes, result.recipes);
            if (mergedRecipes.length) {
                return {
                    ...result,
                    provider: mergedRecipes[0]?.provider || result.provider,
                    recipes: mergedRecipes,
                };
            }
        }
    } catch (error) {
        logRecipeProviderEvent('Gemini Recipe Search Failed', error);
        const isRateLimited = error?.status === 429 || /too many requests|rate limit|resource exhausted/i.test(String(error?.message || ''));
        if (isRateLimited) {
            try {
                const result = keepPantryReadyRecipes(await searchOpenRouterGeminiRecipes(normalized), normalized);
                const mergedRecipes = mergeRecipeSources(localPantryRecipes, result.recipes);
                if (mergedRecipes.length) {
                    return {
                        ...result,
                        provider: mergedRecipes[0]?.provider || result.provider,
                        recipes: mergedRecipes,
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
                recipes: mergedRecipes,
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
                recipes: mergedRecipes,
            };
        }
    } catch (error) {
        logRecipeProviderEvent('Edamam Failed', error);
    }

    return {
        provider: localPantryRecipes[0]?.provider || null,
        quota: null,
        notice: '',
        recipes: localPantryRecipes,
    };
}

export async function fetchRecipeDetails(recipeRef, initialRecipe = null) {
    const provider = recipeRef?.provider || initialRecipe?.provider || 'spoonacular';
    const providerId = recipeRef?.id || recipeRef?.providerId || initialRecipe?.providerId || initialRecipe?.id;

    if (provider === 'gemini' && initialRecipe) {
        return {
            ...initialRecipe,
            provider: 'gemini',
            instructions: initialRecipe.instructions || (initialRecipe.instructionSteps || []).join('\n'),
        };
    }

    if (provider === 'edamam' && initialRecipe) {
        return {
            ...initialRecipe,
            provider: 'edamam',
            instructions: initialRecipe.instructions || 'Open the source link for the full step-by-step method.',
        };
    }

    if (provider === 'spoonacular') {
        const { data } = await spoonacularFetch(`/recipes/${providerId}/information`, { includeNutrition: 'false' });
        return {
            ...mapSpoonacularSummary(data),
            instructions: stripHtml(data.instructions),
            instructionSteps: (data.analyzedInstructions || []).flatMap(g => g.steps || []).map(s => s.step),
            ingredients: (data.extendedIngredients || []).map(i => i.original),
        };
    }

    return initialRecipe;
}
