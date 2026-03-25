import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const SPOONACULAR_BASE_URL = 'https://api.spoonacular.com';
const EDAMAM_BASE_URL = 'https://api.edamam.com';
const THE_MEAL_DB_BASE_URL = 'https://www.themealdb.com/api/json/v1/1';
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

function getSpoonacularApiKey() {
    return String(
        getEnvValue('EXPO_PUBLIC_SPOONACULAR_API_KEY') || getEnvValue('SPOONACULAR_API_KEY'),
    ).trim();
}

function getEdamamCredentials() {
    return {
        appId: String(getEnvValue('EXPO_PUBLIC_EDAMAM_APP_ID') || getEnvValue('EDAMAM_APP_ID')).trim(),
        appKey: String(getEnvValue('EXPO_PUBLIC_EDAMAM_APP_KEY') || getEnvValue('EDAMAM_APP_KEY')).trim(),
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

function summarizeErrorMessage(detail, fallbackMessage) {
    return String(detail || fallbackMessage || 'Request failed').trim();
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

async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);

    if (!response.ok) {
        const detail = await parseError(response);
        throw Object.assign(new Error(summarizeErrorMessage(detail, 'Request failed')), {
            status: response.status,
            detail,
        });
    }

    return response.json();
}

async function spoonacularFetch(path, query = {}) {
    const apiKey = getSpoonacularApiKey();

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

        throw Object.assign(new Error(summarizeErrorMessage(detail, 'Spoonacular request failed')), {
            code: authLikeFailure ? 'AUTH_ERROR' : 'API_ERROR',
            status: response.status,
            detail,
            provider: 'spoonacular',
        });
    }

    const quota = {
        used: response.headers.get('X-API-Quota-Used') ? Number(response.headers.get('X-API-Quota-Used')) : null,
        requestCost: response.headers.get('X-API-Quota-Request') ? Number(response.headers.get('X-API-Quota-Request')) : null,
    };

    await persistQuotaSnapshot(quota);

    return {
        data: await response.json(),
        quota,
    };
}

function buildIngredientMatch(selectedIngredients, sourceIngredients) {
    const available = new Set((selectedIngredients || []).map(normalizeIngredient).filter(Boolean));
    const allIngredients = uniqueList(sourceIngredients);
    const have = [];
    const missing = [];

    allIngredients.forEach((ingredient) => {
        const normalizedIngredient = normalizeIngredient(ingredient);
        const matches = Array.from(available).some(
            (item) => normalizedIngredient.includes(item) || item.includes(normalizedIngredient),
        );

        if (matches) {
            have.push(ingredient);
        } else {
            missing.push(ingredient);
        }
    });

    return {
        have,
        missing,
    };
}

function mapSpoonacularSummary(recipe) {
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
        missingCount: recipe.missedIngredientCount ?? 0,
        likes: recipe.likes ?? 0,
        summary: stripHtml(recipe.summary),
        vegetarian: typeof recipe.vegetarian === 'boolean' ? recipe.vegetarian : null,
        vegan: typeof recipe.vegan === 'boolean' ? recipe.vegan : null,
        usedIngredients: Array.isArray(recipe.usedIngredients)
            ? recipe.usedIngredients.map((item) => item?.original || item?.name).filter(Boolean)
            : [],
        missingIngredients: Array.isArray(recipe.missedIngredients)
            ? recipe.missedIngredients.map((item) => item?.original || item?.name).filter(Boolean)
            : [],
    };
}

async function enrichSpoonacularRecipesWithDietInfo(recipes) {
    const recipeIds = recipes.map((recipe) => recipe.providerId).filter(Boolean);

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
                String(item.id),
                {
                    vegetarian: typeof item.vegetarian === 'boolean' ? item.vegetarian : null,
                    vegan: typeof item.vegan === 'boolean' ? item.vegan : null,
                },
            ]),
        );

        return recipes.map((recipe) => ({
            ...recipe,
            ...byId.get(recipe.providerId),
        }));
    } catch {
        return recipes;
    }
}

async function searchSpoonacularRecipes(ingredients) {
    const { data, quota } = await spoonacularFetch('/recipes/findByIngredients', {
        ingredients: ingredients.join(','),
        number: '12',
        ranking: '2',
        ignorePantry: 'true',
    });

    const recipes = Array.isArray(data) ? data.map(mapSpoonacularSummary) : [];
    const enrichedRecipes = await enrichSpoonacularRecipesWithDietInfo(recipes);

    return {
        provider: 'spoonacular',
        recipes: enrichedRecipes,
        quota: {
            ...quota,
            remaining: typeof quota?.used === 'number' ? Math.max(0, 50 - quota.used) : null,
            dailyLimit: 50,
        },
    };
}

function mapEdamamRecipe(hit, selectedIngredients) {
    const recipe = hit?.recipe || {};
    const ingredients = Array.isArray(recipe.ingredientLines) ? recipe.ingredientLines : [];
    const ingredientBreakdown = buildIngredientMatch(selectedIngredients, ingredients);
    const healthLabels = Array.isArray(recipe.healthLabels) ? recipe.healthLabels : [];
    const uri = String(recipe.uri || '');

    return {
        id: uri || recipe.label,
        providerId: uri || recipe.label,
        provider: 'edamam',
        name: recipe.label || 'Recipe',
        image: recipe.image || '',
        imageLabel: String(recipe.label || 'RECIPE').slice(0, 8).toUpperCase(),
        cookTime: recipe.totalTime ? `${recipe.totalTime} min` : 'Web recipe',
        difficulty: recipe.totalTime > 45 ? 'Hard' : recipe.totalTime > 25 ? 'Medium' : 'Easy',
        matchingCount: ingredientBreakdown.have.length,
        missingCount: ingredientBreakdown.missing.length,
        likes: 0,
        summary: `Recipe from ${recipe.source || 'Edamam'}`,
        sourceUrl: recipe.url || '',
        servings: recipe.yield || null,
        vegetarian: healthLabels.includes('Vegetarian') || healthLabels.includes('Vegan') ? true : false,
        vegan: healthLabels.includes('Vegan'),
        ingredients,
        usedIngredients: ingredientBreakdown.have,
        missingIngredients: ingredientBreakdown.missing,
        instructionSteps: [],
        selfUrl: hit?._links?.self?.href || '',
    };
}

async function fetchEdamamRecipeBySelfUrl(selfUrl) {
    const { appId, appKey } = getEdamamCredentials();

    if (!selfUrl || !appId || !appKey) {
        return null;
    }

    const separator = selfUrl.includes('?') ? '&' : '?';
    return fetchJson(`${selfUrl}${separator}app_id=${encodeURIComponent(appId)}&app_key=${encodeURIComponent(appKey)}`);
}

async function searchEdamamRecipes(ingredients) {
    const { appId, appKey } = getEdamamCredentials();

    if (!appId || !appKey) {
        throw Object.assign(new Error('Missing Edamam API credentials'), {
            code: 'MISSING_API_KEY',
            provider: 'edamam',
        });
    }

    const params = new URLSearchParams({
        type: 'public',
        q: ingredients.join(' '),
        app_id: appId,
        app_key: appKey,
    });

    const data = await fetchJson(`${EDAMAM_BASE_URL}/api/recipes/v2?${params.toString()}`);
    const recipes = Array.isArray(data?.hits) ? data.hits.map((hit) => mapEdamamRecipe(hit, ingredients)).filter(Boolean) : [];

    return {
        provider: 'edamam',
        recipes: recipes.slice(0, 12),
        quota: null,
    };
}

function extractMealDbIngredients(meal) {
    const ingredients = [];

    for (let index = 1; index <= 20; index += 1) {
        const ingredient = String(meal?.[`strIngredient${index}`] || '').trim();
        const measure = String(meal?.[`strMeasure${index}`] || '').trim();

        if (!ingredient) {
            continue;
        }

        ingredients.push(`${measure ? `${measure} ` : ''}${ingredient}`.trim());
    }

    return ingredients;
}

function mapMealDbMeal(meal, selectedIngredients) {
    const ingredients = extractMealDbIngredients(meal);
    const ingredientBreakdown = buildIngredientMatch(selectedIngredients, ingredients);
    const isVegetarian = ['Vegetarian', 'Vegan'].includes(String(meal?.strCategory || ''));
    const isVegan = String(meal?.strCategory || '') === 'Vegan';

    return {
        id: String(meal.idMeal),
        providerId: String(meal.idMeal),
        provider: 'themealdb',
        name: meal.strMeal || 'Recipe',
        image: meal.strMealThumb || '',
        imageLabel: String(meal.strMeal || 'RECIPE').slice(0, 8).toUpperCase(),
        cookTime: meal.strArea ? `${meal.strArea} style` : 'MealDB recipe',
        difficulty: 'Medium',
        matchingCount: ingredientBreakdown.have.length,
        missingCount: ingredientBreakdown.missing.length,
        likes: 0,
        summary: stripHtml(meal.strInstructions).slice(0, 220),
        sourceUrl: meal.strSource || meal.strYoutube || '',
        servings: null,
        vegetarian: isVegetarian,
        vegan: isVegan,
        ingredients,
        usedIngredients: ingredientBreakdown.have,
        missingIngredients: ingredientBreakdown.missing,
        instructions: stripHtml(meal.strInstructions),
        instructionSteps: stripHtml(meal.strInstructions)
            .split(/\.\s+/)
            .map((item) => item.trim())
            .filter(Boolean),
    };
}

async function searchMealDbRecipes(ingredients) {
    const scoreMap = new Map();

    for (const ingredient of ingredients) {
        const data = await fetchJson(`${THE_MEAL_DB_BASE_URL}/filter.php?i=${encodeURIComponent(ingredient)}`);
        const meals = Array.isArray(data?.meals) ? data.meals : [];

        meals.forEach((meal) => {
            const key = String(meal.idMeal);
            const current = scoreMap.get(key) || {
                meal,
                score: 0,
            };

            current.score += 1;
            scoreMap.set(key, current);
        });
    }

    const rankedMeals = Array.from(scoreMap.values())
        .sort((left, right) => right.score - left.score)
        .slice(0, 12);

    const detailedMeals = await Promise.all(
        rankedMeals.map(async ({ meal }) => {
            const data = await fetchJson(`${THE_MEAL_DB_BASE_URL}/lookup.php?i=${encodeURIComponent(meal.idMeal)}`);
            return Array.isArray(data?.meals) ? data.meals[0] : null;
        }),
    );

    const recipes = detailedMeals
        .filter(Boolean)
        .map((meal) => mapMealDbMeal(meal, ingredients));

    return {
        provider: 'themealdb',
        recipes,
        quota: null,
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

export async function fetchRecipesByIngredients(ingredients) {
    const normalized = Array.from(
        new Set(
            (ingredients || [])
                .map((item) => String(item).trim().toLowerCase())
                .filter(Boolean),
        ),
    );

    if (!normalized.length) {
        return {
            recipes: [],
            quota: null,
            provider: null,
        };
    }

    const providers = [
        () => searchSpoonacularRecipes(normalized),
        () => searchEdamamRecipes(normalized),
        () => searchMealDbRecipes(normalized),
    ];

    let lastError = null;

    for (const runProvider of providers) {
        try {
            const result = await runProvider();
            if (result?.recipes?.length) {
                return result;
            }
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('No recipe provider is currently available.');
}

export async function fetchRecipeDetails(recipeRef, initialRecipe = null) {
    const provider = recipeRef?.provider || initialRecipe?.provider || 'spoonacular';
    const providerId = recipeRef?.id || recipeRef?.providerId || initialRecipe?.providerId || initialRecipe?.id;

    if (provider === 'spoonacular') {
        const { data } = await spoonacularFetch(`/recipes/${providerId}/information`, {
            includeNutrition: 'false',
        });

        return {
            id: String(data.id),
            providerId: String(data.id),
            provider: 'spoonacular',
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

    if (provider === 'edamam') {
        const remoteRecipe = await fetchEdamamRecipeBySelfUrl(initialRecipe?.selfUrl);
        const recipe = remoteRecipe?.recipe || initialRecipe || {};
        const ingredients = Array.isArray(recipe.ingredientLines) ? recipe.ingredientLines : (initialRecipe?.ingredients || []);

        return {
            ...initialRecipe,
            id: initialRecipe?.id || providerId,
            providerId: initialRecipe?.providerId || providerId,
            provider: 'edamam',
            name: recipe.label || initialRecipe?.name || 'Recipe',
            image: recipe.image || initialRecipe?.image || '',
            readyInMinutes: recipe.totalTime || null,
            servings: recipe.yield || initialRecipe?.servings || null,
            sourceUrl: recipe.url || initialRecipe?.sourceUrl || '',
            summary: initialRecipe?.summary || `Recipe from ${recipe.source || 'Edamam'}`,
            instructions: initialRecipe?.instructions || 'Open the source recipe to view the full method.',
            instructionSteps: initialRecipe?.instructionSteps || [],
            ingredients,
            vegetarian: initialRecipe?.vegetarian ?? null,
            vegan: initialRecipe?.vegan ?? null,
        };
    }

    if (provider === 'themealdb') {
        const data = await fetchJson(`${THE_MEAL_DB_BASE_URL}/lookup.php?i=${encodeURIComponent(providerId)}`);
        const meal = Array.isArray(data?.meals) ? data.meals[0] : null;

        if (!meal) {
            return initialRecipe;
        }

        const mapped = mapMealDbMeal(meal, initialRecipe?.usedIngredients || []);
        return {
            ...mapped,
            readyInMinutes: null,
        };
    }

    return initialRecipe;
}
