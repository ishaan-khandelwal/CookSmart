import { generateGeminiContent, normalizeGeminiModelName } from './geminiApi';
import { DEFAULT_RECIPE_MODE, RECIPE_MODE_IDS } from '../constants/recipeModes';
import { fetchRecipesByIngredients } from './spoonacularApi';
import Constants from 'expo-constants';

const GEMINI_SUPPORT_MODEL = 'gemini-2.0-flash';

function getExtraConfigValue(key) {
    return (
        Constants.expoConfig?.extra?.[key] ||
        Constants.manifest2?.extra?.expoClient?.extra?.[key] ||
        ''
    );
}

function getEnvValue(key) {
    return process.env?.[key] || getExtraConfigValue(key) || '';
}

function sanitizeApiKey(rawValue) {
    const apiKey = String(rawValue || '')
        .trim()
        .replace(/^['"]|['"]$/g, '')
        .replace(/[\t\n\r]/g, '')
        .trim();

    if (!apiKey || apiKey === 'your_key_here' || apiKey.includes('your_real_')) {
        return '';
    }

    return apiKey;
}

function getSupportApiKey() {
    return sanitizeApiKey(getEnvValue('EXPO_PUBLIC_GEMINI_KEY'));
}

function parseGeminiText(data) {
    const parts = Array.isArray(data?.candidates?.[0]?.content?.parts) ? data.candidates[0].content.parts : [];

    return parts
        .map((part) => (typeof part?.text === 'string' ? part.text : ''))
        .join('\n')
        .trim();
}

function createFallbackReply(message) {
    const normalized = String(message || '').toLowerCase();

    if (/(what|which).*(make|cook)|recipe idea|meal idea|what can i make|what should i cook/.test(normalized)) {
        return 'Share 2 to 6 ingredients like "egg, onion, tomato, bread" and I will suggest a few quick dishes you can make.';
    }

    if (/scan|camera|photo|blurry|blur|ingredient/.test(normalized)) {
        return 'Try the back camera in bright light, fill most of the scan frame, and keep the phone steady for one clean shot. If the image is still soft, move a little closer and avoid shadows crossing the ingredients.';
    }

    if (/login|sign in|signin|account|password/.test(normalized)) {
        return 'Start by checking that you are using the same email you registered with. If sign-in still fails, close and reopen the app, then try again on a stable connection.';
    }

    if (/recipe|result|search|quota/.test(normalized)) {
        return 'If recipe results look limited, try scanning fewer ingredients with clearer labels or search with 2 to 5 core items. If quota is low, wait for the next synced search window or use a shorter ingredient list.';
    }

    if (/favorite|save|history|planner/.test(normalized)) {
        return 'Saved recipes, history, and planner entries work best when you are signed in. Open the related screen again after reconnecting so the latest cloud data can refresh.';
    }

    return 'I can help with scanning ingredients, recipe results, account issues, saved recipes, and planner questions. Tell me what is going wrong and I will guide you step by step.';
}

function normalizeIngredientList(items) {
    return Array.from(
        new Set(
            (items || [])
                .map((item) => String(item || '').trim().toLowerCase())
                .filter(Boolean),
        ),
    );
}

function isRecipeIntent(message) {
    const normalized = String(message || '').toLowerCase();
    return /(what|which).*(make|cook)|recipe idea|meal idea|dish idea|what can i make|what should i cook|cook from|make from|with these ingredients|using these ingredients/.test(normalized);
}

function extractIngredientsFromMessage(message) {
    const normalized = String(message || '')
        .toLowerCase()
        .replace(/[?.!]/g, ' ')
        .replace(/\band\b/g, ',')
        .replace(/\bwith these ingredients\b/g, ' ')
        .replace(/\busing these ingredients\b/g, ' ')
        .replace(/\bwhat can i make\b/g, ' ')
        .replace(/\bwhat should i cook\b/g, ' ')
        .replace(/\bfrom these ingredients\b/g, ' ')
        .replace(/\bmake from\b/g, ' ')
        .replace(/\bcook from\b/g, ' ');

    const matches = normalized.match(/\b[a-z][a-z\s-]{1,24}\b/g) || [];
    const stopWords = new Set([
        'what', 'can', 'i', 'make', 'cook', 'from', 'these', 'ingredients', 'ingredient', 'using', 'with',
        'the', 'a', 'an', 'and', 'or', 'please', 'something', 'quick', 'easy', 'for', 'my', 'me', 'do', 'have',
        'have got', 'got', 'there', 'is', 'are', 'recipe', 'recipes', 'meal', 'ideas', 'idea', 'dish', 'dishes',
    ]);

    const cleaned = matches
        .map((item) => item.trim())
        .filter((item) => !stopWords.has(item) && item.split(' ').length <= 3);

    if (normalized.includes(',')) {
        return normalizeIngredientList(
            normalized
                .split(',')
                .map((item) => item.trim())
                .filter((item) => item && !stopWords.has(item)),
        );
    }

    return normalizeIngredientList(cleaned);
}

function formatRecipeSuggestionReply(recipes, ingredients, mode) {
    const topRecipes = (recipes || []).slice(0, 3);
    if (!topRecipes.length) {
        return ingredients.length
            ? `I could not find a strong match for ${ingredients.join(', ')} yet. Try adding one or two more core ingredients and I will suggest better recipes.`
            : 'Tell me a few ingredients you have, like "egg, onion, tomato", and I will suggest recipes.';
    }

    const intro = mode === RECIPE_MODE_IDS.COOK_FREEDOM
        ? `Here are a few recipe ideas based on ${ingredients.join(', ')}. Some may need 1 or 2 extra items.`
        : `Here are a few things you can make from ${ingredients.join(', ')}.`;

    const lines = topRecipes.map((recipe, index) => {
        const used = Array.isArray(recipe?.usedIngredients) && recipe.usedIngredients.length
            ? `Uses: ${recipe.usedIngredients.slice(0, 3).join(', ')}.`
            : '';
        const missing = Number(recipe?.missingCount || 0) > 0 && Array.isArray(recipe?.missingIngredients)
            ? ` Needs: ${recipe.missingIngredients.slice(0, 2).join(', ')}.`
            : '';
        return `${index + 1}. ${recipe.name} - ${recipe.cookTime || 'Quick meal'}. ${used}${missing}`.trim();
    });

    return [intro, ...lines].join('\n');
}

export async function getHelpSupportReply(message, options = {}) {
    const trimmedMessage = String(message || '').trim();
    if (!trimmedMessage) {
        return 'Tell me what you need help with and I will walk you through it.';
    }

    const apiKey = getSupportApiKey();
    if (!apiKey) {
        if (!isRecipeIntent(trimmedMessage)) {
            return createFallbackReply(trimmedMessage);
        }
    }

    const availableIngredients = normalizeIngredientList(options.availableIngredients);
    const messageIngredients = extractIngredientsFromMessage(trimmedMessage);
    const candidateIngredients = messageIngredients.length >= 2 ? messageIngredients : availableIngredients;
    const recipeMode = options.recipeMode === RECIPE_MODE_IDS.COOK_FREEDOM
        ? RECIPE_MODE_IDS.COOK_FREEDOM
        : DEFAULT_RECIPE_MODE;

    if (isRecipeIntent(trimmedMessage)) {
        if (!candidateIngredients.length) {
            return 'Tell me the ingredients you have, like "egg, bread, onion, tomato", and I will suggest a few dishes right away.';
        }

        try {
            const result = await fetchRecipesByIngredients(candidateIngredients, { mode: recipeMode });
            return formatRecipeSuggestionReply(result?.recipes || [], candidateIngredients, recipeMode);
        } catch {
            return createFallbackReply(trimmedMessage);
        }
    }

    const conversation = Array.isArray(options.history) ? options.history.slice(-6) : [];
    const conversationText = conversation
        .map((entry) => `${entry.role === 'user' ? 'User' : 'Assistant'}: ${entry.text}`)
        .join('\n');

    try {
        const { data } = await generateGeminiContent({
            apiKey,
            preferredModel: normalizeGeminiModelName(getEnvValue('EXPO_PUBLIC_GEMINI_MODEL')) || GEMINI_SUPPORT_MODEL,
            body: {
                contents: [
                    {
                        parts: [
                            {
                                text: `You are CookSmart Assistant, a concise in-app chatbot for a cooking app with ingredient scanning, AI recipe search, favorites, planner, and account screens.

Rules:
- Handle both app support and simple cooking guidance.
- Keep replies practical and short.
- Use plain language.
- Prefer 2 or 3 actionable steps.
- If the user asks what they can cook, answer directly with recipe guidance instead of support troubleshooting.
- If a feature may depend on API keys or network, say so simply.
- If unsure, give the safest likely troubleshooting path.

Recent known ingredients:
${availableIngredients.length ? availableIngredients.join(', ') : 'None available.'}

Conversation so far:
${conversationText || 'No previous messages.'}

Latest user question:
${trimmedMessage}`,
                            },
                        ],
                    },
                ],
            },
        });

        const text = parseGeminiText(data);
        return text || createFallbackReply(trimmedMessage);
    } catch {
        return createFallbackReply(trimmedMessage);
    }
}
