import Constants from 'expo-constants';

const SPOONACULAR_BASE_URL = 'https://api.spoonacular.com';

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
        throw Object.assign(new Error(detail || 'Spoonacular request failed'), {
            code: response.status === 401 || response.status === 402 || response.status === 403 ? 'AUTH_ERROR' : 'API_ERROR',
            status: response.status,
            detail,
        });
    }

    return response.json();
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
    };
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

    const data = await spoonacularFetch('/recipes/findByIngredients', {
        ingredients: normalized.join(','),
        number: '12',
        ranking: '2',
        ignorePantry: 'true',
    });

    return Array.isArray(data) ? data.map(mapRecipeSummary) : [];
}

export async function fetchRecipeDetails(recipeId) {
    const data = await spoonacularFetch(`/recipes/${recipeId}/information`, {
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
        ingredients: Array.isArray(data.extendedIngredients)
            ? data.extendedIngredients.map((item) => item?.original).filter(Boolean)
            : [],
    };
}
