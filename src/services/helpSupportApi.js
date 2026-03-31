import { generateGeminiContent, normalizeGeminiModelName } from './geminiApi';

const GEMINI_SUPPORT_MODEL = 'gemini-2.0-flash';

function getEnvValue(key) {
    return process.env?.[key] || '';
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

export async function getHelpSupportReply(message, options = {}) {
    const trimmedMessage = String(message || '').trim();
    if (!trimmedMessage) {
        return 'Tell me what you need help with and I will walk you through it.';
    }

    const apiKey = getSupportApiKey();
    if (!apiKey) {
        return createFallbackReply(trimmedMessage);
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
                                text: `You are CookSmart Support, a concise in-app help chatbot for a cooking app with ingredient scanning, AI recipe search, favorites, planner, and account screens.

Rules:
- Give direct app support only.
- Keep replies practical and short.
- Use plain language.
- Prefer 2 or 3 actionable steps.
- If a feature may depend on API keys or network, say so simply.
- If unsure, give the safest likely troubleshooting path.

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
