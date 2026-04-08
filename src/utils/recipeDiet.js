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

    if (recipe?.vegetarian === false) {
        return 'non-veg';
    }

    const searchableText = collectRecipeSearchText(recipe);
    if (hasAnyKeyword(searchableText, NON_VEG_KEYWORDS)) {
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
    return getRecipeDietType(recipe) !== 'veg';
}

export function getRecipeDietLabel(recipe) {
    return isVegRecipe(recipe) ? 'Veg' : 'Non-Veg';
}

export function getRecipeDietTone(recipe) {
    return isVegRecipe(recipe) ? '#22C55E' : '#FF6B6B';
}
