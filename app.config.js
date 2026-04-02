const EXPO_EXTRA_KEYS = [
    'EXPO_PUBLIC_ANTHROPIC_KEY',
    'EXPO_PUBLIC_ANTHROPIC_MODEL',
    'EXPO_PUBLIC_API_URL',
    'EXPO_PUBLIC_EDAMAM_APP_ID',
    'EXPO_PUBLIC_EDAMAM_APP_KEY',
    'EXPO_PUBLIC_GEMINI_KEY',
    'EXPO_PUBLIC_GEMINI_MODEL',
    'EXPO_PUBLIC_OPENROUTER_KEY',
    'EXPO_PUBLIC_OPENROUTER_MODEL',
    'EXPO_PUBLIC_OPENROUTER_IMAGE_MODEL',
    'EXPO_PUBLIC_SPOONACULAR_API_KEY',
    'SPOONACULAR_API_KEY',
    'EDAMAM_APP_ID',
    'EDAMAM_APP_KEY',
];

module.exports = ({ config }) => {
    const baseConfig = config || {};
    const extra = { ...(baseConfig.extra || {}) };

    EXPO_EXTRA_KEYS.forEach((key) => {
        if (process.env[key] !== undefined) {
            extra[key] = process.env[key];
        }
    });

    return {
        ...baseConfig,
        extra,
    };
};
