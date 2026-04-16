const NON_VEG_KEYWORDS = [
    'chicken',
    'mutton',
    'lamb',
    'goat',
    'beef',
    'pork',
    'bacon',
    'ham',
    'turkey',
    'duck',
    'fish',
    'salmon',
    'tuna',
    'prawn',
    'shrimp',
    'crab',
    'lobster',
    'anchovy',
    'sardine',
    'sausage',
    'pepperoni',
    'meat',
    'egg',
    'eggs',
];

const VEG_KEYWORDS = [
    'paneer',
    'tofu',
    'chickpea',
    'chickpeas',
    'lentil',
    'lentils',
    'dal',
    'rajma',
    'beans',
    'black beans',
    'kidney beans',
    'peas',
    'mushroom',
    'mushrooms',
    'broccoli',
    'cauliflower',
    'spinach',
    'potato',
    'potatoes',
    'tomato',
    'tomatoes',
    'onion',
    'onions',
    'capsicum',
    'bell pepper',
    'eggplant',
    'aubergine',
    'zucchini',
    'rice',
    'pasta',
    'noodles',
];

function normalizeText(value) {
    return String(value || '').toLowerCase();
}

function hasAnyKeyword(value, keywords) {
    const normalizedValue = normalizeText(value);
    return keywords.some((keyword) => normalizedValue.includes(keyword));
}

function collectRecipeSearchText(recipe) {
    return [
        recipe?.name,
        recipe?.title,
        recipe?.summary,
        ...(Array.isArray(recipe?.ingredients) ? recipe.ingredients : []),
        ...(Array.isArray(recipe?.usedIngredients) ? recipe.usedIngredients : []),
        ...(Array.isArray(recipe?.missingIngredients) ? recipe.missingIngredients : []),
    ].filter(Boolean).join(' ');
}

export function getRecipeDietType(recipe) {
    if (recipe?.vegan === true || recipe?.vegetarian === true) {
        return 'veg';
    }

    const searchableText = collectRecipeSearchText(recipe);

    if (hasAnyKeyword(searchableText, NON_VEG_KEYWORDS)) {
        return 'non-veg';
    }

    if (recipe?.vegetarian === false && !hasAnyKeyword(searchableText, VEG_KEYWORDS)) {
        return 'non-veg';
    }

    if (hasAnyKeyword(searchableText, VEG_KEYWORDS)) {
        return 'veg';
    }

    return 'unknown';
}

export function getRecipeDietFlags(recipe) {
    const dietType = getRecipeDietType(recipe);
    return {
        vegetarian: dietType === 'veg',
        vegan: recipe?.vegan === true,
    };
}

export function isVegRecipe(recipe) {
    return getRecipeDietType(recipe) === 'veg';
}

export function isNonVegRecipe(recipe) {
    return getRecipeDietType(recipe) === 'non-veg';
}

export function getRecipeDietLabel(recipe) {
    const dietType = getRecipeDietType(recipe);
    if (dietType === 'veg') return 'Veg';
    if (dietType === 'non-veg') return 'Non-Veg';
    return 'Unclear';
}

export function getRecipeDietTone(recipe) {
    const dietType = getRecipeDietType(recipe);
    if (dietType === 'veg') return '#22C55E';
    if (dietType === 'non-veg') return '#FF6B6B';
    return '#94A3B8';
}
