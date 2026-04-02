export const RECIPE_MODE_IDS = {
    COOK_FREEDOM: 'cookfreedom',
    PANTRY_CHEF: 'pantrychef',
};

export const DEFAULT_RECIPE_MODE = RECIPE_MODE_IDS.PANTRY_CHEF;
export const RECIPE_MODE_STORAGE_KEY = 'cooksmart:selectedRecipeMode';

export const RECIPE_MODE_OPTIONS = [
    {
        id: RECIPE_MODE_IDS.COOK_FREEDOM,
        title: 'CookFreedom',
        shortTitle: 'CookFreedom',
        icon: 'sparkles-outline',
        accent: '#F59E0B',
        surface: '#1E1609',
        border: 'rgba(245, 158, 11, 0.26)',
        description: 'Browse full recipes freely and order anything you are missing later.',
        ctaLabel: 'Explore Recipes',
        ctaDescription: 'Flexible recipe ideas with missing-item guidance.',
    },
    {
        id: RECIPE_MODE_IDS.PANTRY_CHEF,
        title: 'PantryChef',
        shortTitle: 'PantryChef',
        icon: 'restaurant-outline',
        accent: '#22C55E',
        surface: '#102015',
        border: 'rgba(34, 197, 94, 0.26)',
        description: 'Generate only recipes that match the ingredients already in your kitchen.',
        ctaLabel: 'Scan Pantry',
        ctaDescription: 'Strict pantry-only matches from what you have at home.',
    },
];

export function getRecipeModeMeta(mode) {
    return RECIPE_MODE_OPTIONS.find((item) => item.id === mode) || RECIPE_MODE_OPTIONS[1];
}
