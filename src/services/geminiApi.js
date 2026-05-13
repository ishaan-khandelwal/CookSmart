const GEMINI_API_ROOT = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_GEMINI_MODELS = [
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash',
];

function normalizeGeminiModelName(model) {
    return String(model || '').trim().replace(/^models\//, '');
}

async function extractGeminiErrorDetail(response) {
    try {
        const payload = await response.json();
        return payload?.error?.message || payload?.message || JSON.stringify(payload);
    } catch {
        return await response.text();
    }
}

function createGeminiError(message, response, model) {
    const detail = String(message || '').toLowerCase();
    const isRateLimit = response?.status === 429 || detail.includes('rate limit') || detail.includes('too many requests') || detail.includes('resource exhausted');
    
    return Object.assign(new Error(message || 'Gemini request failed'), {
        code: response?.status === 401 || response?.status === 403 ? 'AUTH_ERROR' : 'API_ERROR',
        status: isRateLimit ? 429 : response?.status,
        provider: 'gemini',
        model,
    });
}

function isModelCompatibilityError(error) {
    const detail = String(error?.message || '').toLowerCase();
    return (
        error?.status === 404 ||
        detail.includes('not found') ||
        detail.includes('not supported for generatecontent') ||
        detail.includes('unsupported model')
    );
}

function rankGeminiModels(models) {
    return [...models].sort((left, right) => {
        const leftScore = left.includes('2.0-flash') ? 0 : left.includes('1.5-flash') ? 1 : left.includes('flash') ? 2 : 3;
        const rightScore = right.includes('2.0-flash') ? 0 : right.includes('1.5-flash') ? 1 : right.includes('flash') ? 2 : 3;
        return leftScore - rightScore || left.localeCompare(right);
    });
}

function uniqueModels(models) {
    return Array.from(
        new Set(
            (models || [])
                .map(normalizeGeminiModelName)
                .filter(Boolean),
        ),
    );
}

async function listGeminiGenerateContentModels(apiKey) {
    const response = await fetch(`${GEMINI_API_ROOT}/models?key=${apiKey}`);
    if (!response.ok) {
        const detail = await extractGeminiErrorDetail(response);
        throw createGeminiError(detail, response, '');
    }

    const payload = await response.json();
    const supported = Array.isArray(payload?.models)
        ? payload.models
            .filter((model) => Array.isArray(model?.supportedGenerationMethods) && model.supportedGenerationMethods.includes('generateContent'))
            .map((model) => normalizeGeminiModelName(model?.name))
        : [];

    return rankGeminiModels(uniqueModels(supported));
}

async function postGeminiGenerateContent(apiKey, model, body) {
    let response;

    try {
        response = await fetch(`${GEMINI_API_ROOT}/models/${model}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
    } catch (error) {
        throw Object.assign(new Error(error?.message || 'Network request failed'), {
            code: 'NETWORK_ERROR',
            provider: 'gemini',
            model,
        });
    }

    if (!response.ok) {
        const detail = await extractGeminiErrorDetail(response);
        throw createGeminiError(detail, response, model);
    }

    return response.json();
}

export async function generateGeminiContent({
    apiKey,
    body,
    preferredModel = '',
    fallbackModels = DEFAULT_GEMINI_MODELS,
}) {
    const attempted = new Set();
    let lastError = null;

    const tryModels = async (models) => {
        for (const model of uniqueModels(models)) {
            if (attempted.has(model)) continue;
            attempted.add(model);

            try {
                const data = await postGeminiGenerateContent(apiKey, model, body);
                return { data, model };
            } catch (error) {
                if (isModelCompatibilityError(error)) {
                    lastError = error;
                    continue;
                }

                throw error;
            }
        }

        return null;
    };

    const initialResult = await tryModels([preferredModel, ...fallbackModels]);
    if (initialResult) {
        return initialResult;
    }

    try {
        const supportedModels = await listGeminiGenerateContentModels(apiKey);
        const discoveredResult = await tryModels([preferredModel, ...fallbackModels, ...supportedModels]);
        if (discoveredResult) {
            return discoveredResult;
        }
    } catch (error) {
        if (!lastError) {
            throw error;
        }
    }

    throw lastError || new Error('No compatible Gemini model is available for generateContent.');
}

export { DEFAULT_GEMINI_MODELS, normalizeGeminiModelName };
