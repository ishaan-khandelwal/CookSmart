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
    'maggi',
    'poha',
    'sabzi',
    'dal',
    'roti',
    'paratha',
    'naan',
    'curry',
    'pulao',
    'biryani',
    'dosa',
    'idli',
    'sambar',
    'chutney',
    'salad',
    'soup',
    'bread',
    'toast',
    'cereal',
    'fruit',
    'apple',
    'banana',
    'orange',
    'mango',
    'grapes',
    'milk',
    'curd',
    'yogurt',
    'cheese',
    'butter',
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

    // Check non-veg keywords first
    if (hasAnyKeyword(searchableText, NON_VEG_KEYWORDS)) {
        // Special case: if it contains "eggplant" but also "egg", it might be a false positive
        // but generally "egg" is non-veg in many contexts.
        // We'll keep it simple: if any non-veg keyword is present, it's non-veg.
        return 'non-veg';
    }

    // Check veg keywords
    if (hasAnyKeyword(searchableText, VEG_KEYWORDS)) {
        return 'veg';
    }

    // If API explicitly says it's not vegetarian and we didn't find veg keywords
    if (recipe?.vegetarian === false) {
        return 'non-veg';
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
