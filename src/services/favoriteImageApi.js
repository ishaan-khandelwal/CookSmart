import Constants from 'expo-constants';
import { generateGeminiContent } from './geminiApi';

const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_GEMINI_IMAGE_MODEL = 'google/gemini-2.5-flash-image';
const THEMEALDB_BASE_URL = 'https://www.themealdb.com/api/json/v1/1';
const EDAMAM_BASE_URL = 'https://api.edamam.com';
const SPOONACULAR_BASE_URL = 'https://api.spoonacular.com';
const EDAMAM_ACCOUNT_USER = 'cooksmart-app';
const CURATED_REAL_FAVORITE_PHOTOS = [
    {
        aliases: ['aloo paratha', 'aaloo paratha', 'alu paratha'],
        image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Aloo%20Paratha%20%2896238%29.jpg',
    },
    {
        aliases: ['masala dosa', 'dosa'],
        image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Masala%20dosa%20%2896279%29.jpg',
    },
    {
        aliases: ['paneer tikka'],
        image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Paneer%20tikka.jpg',
    },
    {
        aliases: ['paneer butter masala', 'butter paneer', 'paneer makhani', 'paneer butter curry'],
        image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Butter%20Paneer.JPG',
    },
    {
        aliases: ['chole bhature', 'chole bhatura', 'chhole bhature', 'chhola bhatura'],
        image: 'https://commons.wikimedia.org/wiki/Special:FilePath/CHOLE%20BHATURE.JPG',
    },
    {
        aliases: ['veg biryani', 'vegetable biryani'],
        image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Vegetable%20Biryani%20002.JPG',
    },
    {
        aliases: ['chicken biryani', 'hyderabadi chicken biryani'],
        image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Hyderabadi%20Chicken%20Biryani.jpg',
    },
    {
        aliases: ['mutton biryani', 'lamb biryani'],
        image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Mutton%20Biryani.jpg',
    },
];

function sanitizeRecipeTitle(title) {
    return String(title || '')
        .replace(/\s+/g, ' ')
        .trim();
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
    if (!rawValue) {
        return '';
    }
    return String(rawValue).trim().replace(/^['"]|['"]$/g, '').replace(/[\t\n\r]/g, '').trim();
}

function sanitizeApiKey(rawValue) {
    if (!rawValue) {
        return '';
    }

    const apiKey = String(rawValue).trim().replace(/^['"]|['"]$/g, '').replace(/[\t\n\r]/g, '').trim();
    if (!apiKey || apiKey === 'your_key_here' || apiKey.includes('your_real_')) {
        return '';
    }

    return apiKey;
}

function getSpoonacularApiKey() {
    return sanitizeApiKey(getEnvValue('EXPO_PUBLIC_SPOONACULAR_API_KEY') || getEnvValue('SPOONACULAR_API_KEY'));
}

function getOpenRouterImageConfig() {
    const apiKey = sanitizeApiKey(getEnvValue('EXPO_PUBLIC_OPENROUTER_KEY')) || sanitizeApiKey(getEnvValue('EXPO_PUBLIC_ANTHROPIC_KEY'));

    return {
        apiKey: apiKey.startsWith('sk-or-v1-') ? apiKey : '',
        model: getEnvValue('EXPO_PUBLIC_OPENROUTER_IMAGE_MODEL') || getEnvValue('EXPO_PUBLIC_OPENROUTER_MODEL') || OPENROUTER_GEMINI_IMAGE_MODEL,
    };
}

function getEdamamCredentials() {
    return {
        appId: sanitizeApiKey(getEnvValue('EXPO_PUBLIC_EDAMAM_APP_ID') || getEnvValue('EDAMAM_APP_ID')),
        appKey: sanitizeApiKey(getEnvValue('EXPO_PUBLIC_EDAMAM_APP_KEY') || getEnvValue('EDAMAM_APP_KEY')),
    };
}

function toDataUri(mimeType, base64Data) {
    return `data:${mimeType};base64,${base64Data}`;
}

function createFallbackFavoriteCover(title) {
    const safeTitle = sanitizeRecipeTitle(title) || 'CookSmart Recipe';
    return `https://placehold.co/1200x900/0d1721/F6B44F.png?text=${encodeURIComponent(safeTitle)}`;
}

function normalizeRecipeLookupTitle(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\b(style|recipe|homemade|easy|quick|best|authentic|restaurant)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenizeTitle(value) {
    return normalizeRecipeLookupTitle(value).split(/\s+/).filter(Boolean);
}

function scoreRecipeNameMatch(queryTitle, candidateTitle) {
    const queryTokens = tokenizeTitle(queryTitle);
    const candidateTokens = tokenizeTitle(candidateTitle);

    if (!queryTokens.length || !candidateTokens.length) {
        return 0;
    }

    const candidateTokenSet = new Set(candidateTokens);
    let score = 0;

    queryTokens.forEach((token) => {
        if (candidateTokenSet.has(token)) {
            score += 4;
            return;
        }

        if (candidateTokens.some((candidate) => candidate.includes(token) || token.includes(candidate))) {
            score += 2;
        }
    });

    const normalizedQuery = queryTokens.join(' ');
    const normalizedCandidate = candidateTokens.join(' ');

    if (normalizedCandidate === normalizedQuery) {
        score += 10;
    } else if (normalizedCandidate.includes(normalizedQuery) || normalizedQuery.includes(normalizedCandidate)) {
        score += 5;
    }

    return score;
}

function extractGeneratedImage(response) {
    const parts = Array.isArray(response?.candidates)
        ? response.candidates.flatMap((candidate) => candidate?.content?.parts || [])
        : [];

    for (const part of parts) {
        const inlineData = part?.inlineData || part?.inline_data;
        if (inlineData?.data) {
            return toDataUri(inlineData.mimeType || inlineData.mime_type || 'image/png', inlineData.data);
        }
    }

    return '';
}

function buildFavoriteImagePrompt(title) {
    return `Create a premium, realistic food photograph of "${title}" plated beautifully on a dark restaurant table. No text, no watermark, appetizing, warm lighting, mobile-app friendly framing.`;
}

function findCuratedFavoritePhoto(title) {
    const normalizedTitle = normalizeRecipeLookupTitle(title);
    if (!normalizedTitle) {
        return '';
    }

    let bestMatch = { score: 0, image: '' };

    CURATED_REAL_FAVORITE_PHOTOS.forEach((entry) => {
        entry.aliases.forEach((alias) => {
            const normalizedAlias = normalizeRecipeLookupTitle(alias);

            if (!normalizedAlias) {
                return;
            }

            let score = 0;
            if (normalizedTitle === normalizedAlias) {
                score = 100;
            } else if (normalizedTitle.includes(normalizedAlias)) {
                score = 80 + normalizedAlias.length;
            } else if (normalizedAlias.includes(normalizedTitle)) {
                score = 60 + normalizedTitle.length;
            }

            if (score > bestMatch.score) {
                bestMatch = { score, image: entry.image };
            }
        });
    });

    return bestMatch.image;
}

async function parseError(response) {
    try {
        const payload = await response.json();
        return payload?.error?.message || payload?.message || JSON.stringify(payload);
    } catch {
        return await response.text();
    }
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

async function generateDirectGeminiFavoriteImage(title, geminiApiKey) {
    if (!geminiApiKey) {
        return '';
    }

    const { data } = await generateGeminiContent({
        apiKey: geminiApiKey,
        preferredModel: GEMINI_IMAGE_MODEL,
        fallbackModels: [GEMINI_IMAGE_MODEL],
        body: {
            contents: [
                {
                    parts: [
                        {
                            text: buildFavoriteImagePrompt(title),
                        },
                    ],
                },
            ],
        },
    });

    return extractGeneratedImage(data);
}

async function generateOpenRouterFavoriteImage(title) {
    const { apiKey, model } = getOpenRouterImageConfig();
    if (!apiKey) {
        return '';
    }

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
                    content: buildFavoriteImagePrompt(title),
                },
            ],
            modalities: ['image', 'text'],
            image_config: {
                aspect_ratio: '4:3',
                image_size: '1K',
            },
        }),
    });

    return data?.choices?.[0]?.message?.images?.[0]?.image_url?.url || '';
}

async function generateSpoonacularFavoriteImage(title) {
    const apiKey = getSpoonacularApiKey();
    if (!apiKey) {
        return '';
    }

    const params = new URLSearchParams({
        query: title,
        number: '10',
        apiKey,
    });

    const data = await fetchJson(`${SPOONACULAR_BASE_URL}/recipes/complexSearch?${params.toString()}`);
    const recipes = Array.isArray(data?.results) ? data.results : [];
    const rankedRecipes = recipes
        .filter((recipe) => recipe?.image)
        .map((recipe) => ({
            image: recipe.image,
            score: scoreRecipeNameMatch(title, recipe?.title),
        }))
        .filter((recipe) => recipe.score >= 4)
        .sort((left, right) => right.score - left.score);

    return rankedRecipes[0]?.image || '';
}

async function generateMealDbFavoriteImage(title) {
    const data = await fetchJson(`${THEMEALDB_BASE_URL}/search.php?s=${encodeURIComponent(title)}`);
    const meals = Array.isArray(data?.meals) ? data.meals : [];

    const rankedMeals = meals
        .filter((meal) => meal?.strMealThumb)
        .map((meal) => ({
            image: meal.strMealThumb,
            score: scoreRecipeNameMatch(title, meal?.strMeal),
        }))
        .filter((meal) => meal.score >= 4)
        .sort((left, right) => right.score - left.score);

    return rankedMeals[0]?.image || '';
}

async function generateEdamamFavoriteImage(title) {
    const { appId, appKey } = getEdamamCredentials();
    if (!appId || !appKey) {
        return '';
    }

    const params = new URLSearchParams({
        type: 'public',
        q: title,
        app_id: appId,
        app_key: appKey,
    });

    const data = await fetchJson(`${EDAMAM_BASE_URL}/api/recipes/v2?${params.toString()}`, {
        headers: {
            'Edamam-Account-User': EDAMAM_ACCOUNT_USER,
        },
    });

    const hits = Array.isArray(data?.hits) ? data.hits : [];
    const rankedHits = hits
        .map((item) => ({
            image: item?.recipe?.image || '',
            score: scoreRecipeNameMatch(title, item?.recipe?.label),
        }))
        .filter((item) => item.image && item.score >= 4)
        .sort((left, right) => right.score - left.score);

    return rankedHits[0]?.image || '';
}

export async function findRealFavoriteImageFromTitle(title) {
    const safeTitle = sanitizeRecipeTitle(title);
    if (!safeTitle) {
        return '';
    }

    const curatedImage = findCuratedFavoritePhoto(safeTitle);
    if (curatedImage) {
        return curatedImage;
    }

    try {
        const spoonacularImage = await generateSpoonacularFavoriteImage(safeTitle);
        if (spoonacularImage) {
            return spoonacularImage;
        }
    } catch { }

    try {
        const mealDbImage = await generateMealDbFavoriteImage(safeTitle);
        if (mealDbImage) {
            return mealDbImage;
        }
    } catch { }

    try {
        const edamamImage = await generateEdamamFavoriteImage(safeTitle);
        if (edamamImage) {
            return edamamImage;
        }
    } catch { }

    return '';
}

export async function generateFavoriteImageFromTitle(title, geminiApiKey) {
    const safeTitle = sanitizeRecipeTitle(title);
    if (!safeTitle) {
        return '';
    }

    try {
        const realFavoriteImage = await findRealFavoriteImageFromTitle(safeTitle);
        if (realFavoriteImage) {
            return realFavoriteImage;
        }
    } catch { }

    try {
        const geminiImage = await generateDirectGeminiFavoriteImage(safeTitle, geminiApiKey);
        if (geminiImage) {
            return geminiImage;
        }
    } catch { }

    try {
        const openRouterImage = await generateOpenRouterFavoriteImage(safeTitle);
        if (openRouterImage) {
            return openRouterImage;
        }
    } catch { }

    return createFallbackFavoriteCover(safeTitle);
}
