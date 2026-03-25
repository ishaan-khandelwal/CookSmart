import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const SPOONACULAR_BASE_URL = 'https://api.spoonacular.com';
const SPOONACULAR_QUOTA_STORAGE_KEY = 'cooksmart.spoonacularQuota';

function getExtraConfigValue(key) {
    return (
        Constants.expoConfig?.extra?.[key] ||
        Constants.manifest2?.extra?.expoClient?.extra?.[key] ||
        ''
    );
}

function getEnvValue(key) {
    return process.env[key] || getExtraConfigValue(key) || '';
}

function getApiKey() {
    return String(getEnvValue('EXPO_PUBLIC_SPOONACULAR_API_KEY')).trim();
}

function stripHtml(value) {
    return String(value || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

async function parseError(response) {
    try {
        const payload = await response.json();
        return payload?.message || payload?.error || JSON.stringify(payload);
    } catch {
        return await response.text();
    }
}

async function persistQuotaSnapshot(quota) {
    if (typeof quota?.used !== 'number') {
        return;
    }

    const payload = {
        ...quota,
        remaining: Math.max(0, 50 - quota.used),
        dailyLimit: 50,
        updatedAt: new Date().toISOString(),
    };

    try {
        await AsyncStorage.setItem(SPOONACULAR_QUOTA_STORAGE_KEY, JSON.stringify(payload));
    } catch {
        // Ignore local persistence failures.
    }
}

async function spoonacularFetch(path, query = {}) {
    const apiKey = getApiKey();

    if (!apiKey) {
        throw Object.assign(new Error('Missing Spoonacular API key'), {
            code: 'MISSING_API_KEY',
        });
    }

    const params = new URLSearchParams({ ...query, apiKey });
    const response = await fetch(`${SPOONACULAR_BASE_URL}${path}?${params.toString()}`);

    if (!response.ok) {
        const detail = await parseError(response);
        const authLikeFailure =
            response.status === 401 ||
            response.status === 402 ||
            response.status === 403 ||
            /quota|payment required|limit|credits|unauthorized|forbidden/i.test(String(detail || ''));

        throw Object.assign(new Error(detail || 'Spoonacular request failed'), {
            code: authLikeFailure ? 'AUTH_ERROR' : 'API_ERROR',
            status: response.status,
            detail,
        });
    }

    const quotaUsedHeader = response.headers.get('X-API-Quota-Used');
    const quotaRequestHeader = response.headers.get('X-API-Quota-Request');
    const quota = {
        used: quotaUsedHeader ? Number(quotaUsedHeader) : null,
        requestCost: quotaRequestHeader ? Number(quotaRequestHeader) : null,
    };

    await persistQuotaSnapshot(quota);

    return {
        data: await response.json(),
        quota,
    };
}

export async function getStoredSpoonacularQuota() {
    try {
        const raw = await AsyncStorage.getItem(SPOONACULAR_QUOTA_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function mapRecipeSummary(recipe) {
    return {
        id: recipe.id,
        name: recipe.title,
        image: recipe.image || '',
        imageLabel: String(recipe.title || 'RECIPE').slice(0, 8).toUpperCase(),
        cookTime: recipe.readyInMinutes ? `${recipe.readyInMinutes} min` : 'Quick meal',
        difficulty: recipe.readyInMinutes > 45 ? 'Hard' : recipe.readyInMinutes > 25 ? 'Medium' : 'Easy',
        matchingCount: recipe.usedIngredientCount ?? 0,
        missingCount: recipe.missedIngredientCount ?? 0,
        likes: recipe.likes ?? 0,
        summary: stripHtml(recipe.summary),
        vegetarian: typeof recipe.vegetarian === 'boolean' ? recipe.vegetarian : null,
        vegan: typeof recipe.vegan === 'boolean' ? recipe.vegan : null,
        usedIngredients: Array.isArray(recipe.usedIngredients)
            ? recipe.usedIngredients
                .map((item) => item?.original || item?.name)
                .filter(Boolean)
            : [],
        missingIngredients: Array.isArray(recipe.missedIngredients)
            ? recipe.missedIngredients
                .map((item) => item?.original || item?.name)
                .filter(Boolean)
            : [],
    };
}

async function enrichRecipesWithDietInfo(recipes) {
    const recipeIds = recipes.map((recipe) => recipe.id).filter(Boolean);

    if (!recipeIds.length) {
        return recipes;
    }

    try {
        const { data: details } = await spoonacularFetch('/recipes/informationBulk', {
            ids: recipeIds.join(','),
            includeNutrition: 'false',
        });

        const byId = new Map(
            (Array.isArray(details) ? details : []).map((item) => [
                item.id,
                {
                    vegetarian: typeof item.vegetarian === 'boolean' ? item.vegetarian : null,
                    vegan: typeof item.vegan === 'boolean' ? item.vegan : null,
                },
            ]),
        );

        return recipes.map((recipe) => ({
            ...recipe,
            ...byId.get(recipe.id),
        }));
    } catch {
        return recipes;
    }
}

export async function fetchRecipesByIngredients(ingredients) {
    const normalized = Array.from(
        new Set(
            (ingredients || [])
                .map((item) => String(item).trim().toLowerCase())
                .filter(Boolean),
        ),
    );

    if (!normalized.length) {
        return [];
    }

    const { data, quota } = await spoonacularFetch('/recipes/findByIngredients', {
        ingredients: normalized.join(','),
        number: '12',
        ranking: '2',
        ignorePantry: 'true',
    });

    const recipes = Array.isArray(data) ? data.map(mapRecipeSummary) : [];
    const enrichedRecipes = await enrichRecipesWithDietInfo(recipes);

    return {
        recipes: enrichedRecipes,
        quota: {
            ...quota,
            remaining: typeof quota?.used === 'number' ? Math.max(0, 50 - quota.used) : null,
            dailyLimit: 50,
        },
    };
}

export async function fetchRecipeDetails(recipeId) {
    const { data } = await spoonacularFetch(`/recipes/${recipeId}/information`, {
        includeNutrition: 'false',
    });

    return {
        id: data.id,
        name: data.title,
        image: data.image || '',
        readyInMinutes: data.readyInMinutes || null,
        servings: data.servings || null,
        sourceUrl: data.sourceUrl || '',
        summary: stripHtml(data.summary),
        instructions: stripHtml(data.instructions),
        vegetarian: typeof data.vegetarian === 'boolean' ? data.vegetarian : null,
        vegan: typeof data.vegan === 'boolean' ? data.vegan : null,
        instructionSteps: Array.isArray(data.analyzedInstructions)
            ? data.analyzedInstructions
                .flatMap((group) => group?.steps || [])
                .map((step) => stripHtml(step?.step))
                .filter(Boolean)
            : [],
        ingredients: Array.isArray(data.extendedIngredients)
            ? data.extendedIngredients.map((item) => item?.original).filter(Boolean)
            : [],
    };
}
