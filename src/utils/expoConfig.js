import Constants from 'expo-constants';

export function getExpoExtra(key) {
    return (
        Constants.expoConfig?.extra?.[key] ||
        Constants.manifest2?.extra?.expoClient?.extra?.[key] ||
        ''
    );
}

export function getExpoEnv(key) {
    const rawValue = process.env?.[key] || getExpoExtra(key) || '';

    if (!rawValue) {
        return '';
    }

    return String(rawValue)
        .trim()
        .replace(/^['"]|['"]$/g, '')
        .replace(/[\t\n\r]/g, '')
        .trim();
}

export function hasExpoEnv(key) {
    return Boolean(getExpoEnv(key));
}
