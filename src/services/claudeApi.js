import Constants from 'expo-constants';
import { Alert } from 'react-native';
import { generateGeminiContent, normalizeGeminiModelName } from './geminiApi';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const ANTHROPIC_MODEL = 'claude-3-5-sonnet-latest';
const GEMINI_MODEL = 'gemini-2.0-flash';
const OPENROUTER_MODEL = 'google/gemini-2.0-flash-001';
const OPENROUTER_FALLBACK_MODELS = [
    'anthropic/claude-3.5-sonnet',
    'meta-llama/llama-3.2-11b-vision-instruct',
    OPENROUTER_MODEL,
];
const INGREDIENT_PROMPT = `You are a food ingredient detector. Look at this image and identify ALL visible food ingredients.
Reply ONLY with a valid JSON array of ingredient names in lowercase English.
Example: ["tomato", "garlic", "olive oil", "pasta"]
No explanation. No markdown. Just the JSON array.`;

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

function normalizeIngredients(payload) {
    if (!Array.isArray(payload)) {
        throw Object.assign(new Error('Invalid ingredient payload'), { code: 'INVALID_RESPONSE' });
    }

    return Array.from(
        new Set(
            payload
                .map((item) => String(item).trim().toLowerCase())
                .filter(Boolean),
        ),
    );
}

function sanitizeApiKey(rawValue) {
    if (!rawValue) return '';
    const apiKey = String(rawValue).trim().replace(/^['"]|['"]$/g, '').replace(/[\t\n\r]/g, '').trim();
    if (!apiKey || apiKey === 'your_key_here' || apiKey.includes('your_real_')) {
        return '';
    }
    return apiKey;
}

function getScannerConfig() {
    const anthropicKey = sanitizeApiKey(getEnvValue('EXPO_PUBLIC_ANTHROPIC_KEY'));
    const openRouterKey = sanitizeApiKey(getEnvValue('EXPO_PUBLIC_OPENROUTER_KEY')) || anthropicKey;
    const geminiKey = sanitizeApiKey(getEnvValue('EXPO_PUBLIC_GEMINI_KEY'));

    // Priority for Scanning: 1. OpenRouter, 2. Anthropic, 3. Gemini
    if (openRouterKey.startsWith('sk-or-v1-')) {
        return {
            provider: 'openrouter',
            apiKey: openRouterKey,
            model: getEnvValue('EXPO_PUBLIC_OPENROUTER_MODEL') || OPENROUTER_MODEL,
        };
    }

    if (anthropicKey.startsWith('sk-ant-')) {
        return {
            provider: 'anthropic',
            apiKey: anthropicKey,
            model: getEnvValue('EXPO_PUBLIC_ANTHROPIC_MODEL') || ANTHROPIC_MODEL,
        };
    }

    if (geminiKey.startsWith('AIza')) {
        return {
            provider: 'gemini',
            apiKey: geminiKey,
            model: normalizeGeminiModelName(getEnvValue('EXPO_PUBLIC_GEMINI_MODEL')) || GEMINI_MODEL,
        };
    }

    return {
        provider: null,
        apiKey: '',
        model: '',
    };
}

function getScannerCandidates() {
    const anthropicKey = sanitizeApiKey(getEnvValue('EXPO_PUBLIC_ANTHROPIC_KEY'));
    const openRouterKey = sanitizeApiKey(getEnvValue('EXPO_PUBLIC_OPENROUTER_KEY')) || anthropicKey;
    const geminiKey = sanitizeApiKey(getEnvValue('EXPO_PUBLIC_GEMINI_KEY'));
    const candidates = [];

    if (openRouterKey.startsWith('sk-or-v1-')) {
        candidates.push({
            provider: 'openrouter',
            apiKey: openRouterKey,
            model: getEnvValue('EXPO_PUBLIC_OPENROUTER_MODEL') || OPENROUTER_MODEL,
        });
    }

    if (anthropicKey.startsWith('sk-ant-')) {
        candidates.push({
            provider: 'anthropic',
            apiKey: anthropicKey,
            model: getEnvValue('EXPO_PUBLIC_ANTHROPIC_MODEL') || ANTHROPIC_MODEL,
        });
    }

    if (geminiKey.startsWith('AIza')) {
        candidates.push({
            provider: 'gemini',
            apiKey: geminiKey,
            model: normalizeGeminiModelName(getEnvValue('EXPO_PUBLIC_GEMINI_MODEL')) || GEMINI_MODEL,
        });
    }

    return candidates;
}

function getOpenRouterModelCandidates() {
    const configuredModel = String(getEnvValue('EXPO_PUBLIC_OPENROUTER_MODEL') || OPENROUTER_MODEL).trim();
    const configuredFallbacks = String(getEnvValue('EXPO_PUBLIC_OPENROUTER_FALLBACK_MODELS') || '')
        .split(',')
        .map((item) => String(item).trim())
        .filter(Boolean);

    return Array.from(new Set([configuredModel, ...configuredFallbacks, ...OPENROUTER_FALLBACK_MODELS]));
}

function parseJsonArray(rawText) {
    const trimmedText = rawText.trim();
    const fencedMatch = trimmedText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const jsonText = fencedMatch?.[1]?.trim() || trimmedText;

    try {
        const arrayMatch = jsonText.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
            return JSON.parse(arrayMatch[0]);
        }
        return JSON.parse(jsonText);
    } catch {
        const normalizedText = jsonText
            .replace(/^\s*ingredients?\s*:\s*/i, '')
            .replace(/\r/g, '\n')
            .trim();
        const tokens = normalizedText
            .split(/\n|,/)
            .map((line) => line.replace(/^[\s\[\]\-*0-9.)'"]+|[\[\]'"]+$/g, '').trim().toLowerCase())
            .filter(Boolean)
            .filter((line) => line !== 'json' && line !== 'ingredients');

        if (tokens.length) {
            return tokens;
        }

        throw new Error('Could not parse ingredient array');
    }
}

function parseAnthropicText(data) {
    const textBlocks = Array.isArray(data?.content)
        ? data.content
            .filter((item) => item?.type === 'text' && typeof item?.text === 'string')
            .map((item) => item.text)
        : [];

    return textBlocks.join('\n').trim();
}

function parseGeminiText(data) {
    const textBlocks = Array.isArray(data?.candidates)
        ? data.candidates.flatMap((candidate) =>
            Array.isArray(candidate?.content?.parts)
                ? candidate.content.parts
                    .filter((part) => typeof part?.text === 'string')
                    .map((part) => part.text)
                : [],
        )
        : [];

    return textBlocks.join('\n').trim();
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

async function extractErrorDetail(response) {
    try {
        const errorPayload = await response.json();
        return (
            errorPayload?.error?.message ||
            errorPayload?.message ||
            JSON.stringify(errorPayload)
        );
    } catch {
        return await response.text();
    }
}

async function detectWithAnthropic(base64Image, apiKey, model, mimeType) {
    let response;

    try {
        response = await fetch(ANTHROPIC_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model,
                max_tokens: 500,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: mimeType,
                                    data: base64Image,
                                },
                            },
                            {
                                type: 'text',
                                text: INGREDIENT_PROMPT,
                            },
                        ],
                    },
                ],
            }),
        });
    } catch (error) {
        throw Object.assign(new Error(error?.message || 'Network request failed'), {
            code: 'NETWORK_ERROR',
            provider: 'anthropic',
        });
    }

    if (!response.ok) {
        const errorText = await extractErrorDetail(response);
        throw Object.assign(new Error(errorText || 'Anthropic request failed'), {
            code: response.status === 401 || response.status === 403 ? 'AUTH_ERROR' : 'API_ERROR',
            status: response.status,
            detail: errorText,
            provider: 'anthropic',
        });
    }

    const data = await response.json();
    return parseAnthropicText(data);
}

async function detectWithGemini(base64Image, apiKey, model, mimeType) {
    try {
        const { data } = await generateGeminiContent({
            apiKey,
            preferredModel: model,
            body: {
                contents: [
                    {
                        role: 'user',
                        parts: [
                            {
                                inline_data: {
                                    mime_type: mimeType,
                                    data: base64Image,
                                },
                            },
                            {
                                text: INGREDIENT_PROMPT,
                            },
                        ],
                    },
                ],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 300,
                },
            },
        });

        if (data?.error) {
            throw new Error(`Gemini API Error: ${data.error.message}`);
        }

        return parseGeminiText(data);
    } catch (error) {
        throw Object.assign(new Error(error?.message || 'Gemini request failed'), {
            code: error?.code || 'API_ERROR',
            status: error?.status,
            detail: error?.message,
            provider: 'gemini',
        });
    }
}

async function detectWithOpenRouter(base64Image, apiKey, model, mimeType) {
    const modelCandidates = Array.from(new Set([String(model || '').trim(), ...getOpenRouterModelCandidates()])).filter(Boolean);
    let lastError = null;

    for (const modelCandidate of modelCandidates) {
        let response;

        try {
            response = await fetch(OPENROUTER_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                    'HTTP-Referer': 'https://cooksmart.local',
                    'X-Title': 'CookSmart',
                },
                body: JSON.stringify({
                    model: modelCandidate,
                    messages: [
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'text',
                                    text: INGREDIENT_PROMPT,
                                },
                                {
                                    type: 'image_url',
                                    image_url: {
                                        url: `data:${mimeType};base64,${base64Image}`,
                                    },
                                },
                            ],
                        },
                    ],
                    temperature: 0.2,
                    max_tokens: 300,
                }),
            });
        } catch (error) {
            throw Object.assign(new Error(error?.message || 'Network request failed'), {
                code: 'NETWORK_ERROR',
                provider: 'openrouter',
            });
        }

        if (!response.ok) {
            const errorText = await extractErrorDetail(response);
            const error = Object.assign(new Error(errorText || 'OpenRouter request failed'), {
                code: response.status === 401 || response.status === 403 ? 'AUTH_ERROR' : 'API_ERROR',
                status: response.status,
                detail: errorText,
                provider: 'openrouter',
                model: modelCandidate,
            });

            if (response.status === 401 || response.status === 403) {
                throw error;
            }

            lastError = error;
            continue;
        }

        const data = await response.json();
        const parsedText = parseOpenRouterText(data);
        if (parsedText) {
            return parsedText;
        }

        lastError = Object.assign(new Error('OpenRouter returned empty content'), {
            code: 'INVALID_RESPONSE',
            provider: 'openrouter',
            model: modelCandidate,
        });
    }

    throw lastError || Object.assign(new Error('OpenRouter request failed'), {
        code: 'API_ERROR',
        provider: 'openrouter',
    });
}

export async function detectIngredientsFromImage(base64Image, options = {}) {
    const scannerConfig = getScannerConfig();
    const scannerCandidates = getScannerCandidates();
    const mimeType = options.mimeType || 'image/jpeg';

    if (!scannerCandidates.length || !scannerConfig.provider || !scannerConfig.apiKey) {
        Alert.alert('Scanner Error', 'No Scanner Key found in .env (Add EXPO_PUBLIC_GEMINI_KEY)');
        throw Object.assign(new Error('Missing scanner API key'), {
            code: 'MISSING_API_KEY',
        });
    }

    let lastError = null;

    for (const candidate of scannerCandidates) {
        try {
            let rawText = '';

            if (candidate.provider === 'anthropic') {
                rawText = await detectWithAnthropic(base64Image, candidate.apiKey, candidate.model, mimeType);
            } else if (candidate.provider === 'gemini') {
                rawText = await detectWithGemini(base64Image, candidate.apiKey, candidate.model, mimeType);
            } else {
                rawText = await detectWithOpenRouter(base64Image, candidate.apiKey, candidate.model, mimeType);
            }

            return normalizeIngredients(parseJsonArray(rawText));
        } catch (error) {
            lastError = Object.assign(error || new Error('Scanner request failed'), {
                provider: candidate.provider,
            });
        }
    }

    if (lastError?.code === 'INVALID_RESPONSE') {
        Alert.alert('Scanner Error', 'Could not parse ingredients. AI output was invalid.');
    } else {
        Alert.alert('Scanner Error', `${lastError?.provider || scannerConfig.provider} failed: ${lastError?.message || 'Unknown error'}`);
    }

    throw lastError || Object.assign(new Error('Could not detect ingredients. Try again.'), {
        code: 'API_ERROR',
        provider: scannerConfig.provider,
    });
}

const INGREDIENT_ICONS = {
    tomato: '🍅', tomatoes: '🍅', garlic: '🧄', onion: '🧅', onions: '🧅',
    pasta: '🍝', spaghetti: '🍝', egg: '🥚', eggs: '🥚', rice: '🍚',
    chicken: '🍗', beef: '🥩', pork: '🥓', fish: '🐟', meat: '🍖',
    milk: '🥛', cheese: '🧀', butter: '🧈', yogurt: '🍦',
    flour: '🌾', sugar: '🍭', salt: '🧂', pepper: '🌶️',
    oil: '🧴', vinegar: '🧪', bread: '🍞', toast: '🍞',
    apple: '🍎', banana: '🍌', lemon: '🍋', orange: '🍊',
    carrot: '🥕', potato: '🥔', potatoes: '🥔', spinich: '🌿', spinach: '🌿',
    broccoli: '🥦', corn: '🌽', beans: '🫘', basil: '🌿',
};

export function getIngredientIcon(ingredientName) {
    if (!ingredientName) return '📦';
    const normalized = String(ingredientName).toLowerCase().trim();
    return INGREDIENT_ICONS[normalized] || '📦';
}
