// Turns a spoken ingredient list into ingredient names.
//
// Gnani STT returns unpunctuated text ("i have tomatoes two onions and green chili"),
// so commas alone cannot separate items. Known ingredients (including multi-word ones)
// are matched greedily; unknown words directly before a match are treated as modifiers
// ("green" + "chilli"), and leftover unknown words become their own item.

const ENGLISH_INGREDIENTS = [
  // Vegetables and herbs
  'tomato', 'onion', 'potato', 'garlic', 'ginger', 'spinach', 'capsicum', 'bell pepper', 'carrot',
  'cauliflower', 'cabbage', 'peas', 'green peas', 'brinjal', 'eggplant', 'okra', 'mushroom', 'cucumber',
  'beetroot', 'radish', 'pumpkin', 'zucchini', 'broccoli', 'corn', 'sweet corn', 'beans', 'green beans',
  'lettuce', 'celery', 'spring onion', 'sweet potato', 'bottle gourd', 'bitter gourd', 'drumstick',
  'fenugreek', 'coriander', 'cilantro', 'mint', 'curry leaves', 'chilli', 'green chilli', 'red chilli',
  'lemon', 'lime', 'avocado',
  // Fruits and nuts
  'apple', 'banana', 'mango', 'orange', 'grapes', 'pineapple', 'papaya', 'strawberry', 'pomegranate',
  'coconut', 'watermelon', 'dates', 'raisins', 'peanuts', 'cashews', 'almonds', 'walnuts',
  // Protein
  'paneer', 'tofu', 'chicken', 'chicken breast', 'mutton', 'lamb', 'fish', 'prawns', 'shrimp', 'egg',
  'beef', 'pork', 'bacon', 'sausage', 'soya chunks',
  // Dairy
  'milk', 'curd', 'yogurt', 'butter', 'ghee', 'cheese', 'cream', 'fresh cream', 'cottage cheese', 'mozzarella',
  // Grains and flours
  'rice', 'basmati rice', 'wheat flour', 'atta', 'maida', 'flour', 'besan', 'gram flour', 'suji', 'rava',
  'semolina', 'poha', 'oats', 'bread', 'pasta', 'noodles', 'spaghetti', 'vermicelli', 'quinoa',
  // Pulses
  'dal', 'toor dal', 'moong dal', 'masoor dal', 'chana dal', 'urad dal', 'lentils', 'rajma', 'kidney beans',
  'chole', 'chickpeas', 'chana',
  // Spices, oils and condiments
  'salt', 'sugar', 'jaggery', 'honey', 'turmeric', 'cumin', 'mustard seeds', 'coriander powder',
  'chilli powder', 'garam masala', 'black pepper', 'pepper', 'cinnamon', 'cardamom', 'cloves', 'bay leaf',
  'bay leaves', 'hing', 'oil', 'olive oil', 'mustard oil', 'coconut oil', 'vinegar', 'soy sauce', 'ketchup',
  'mayonnaise', 'peanut butter', 'tamarind', 'sesame', 'coconut milk',
];

// Hindi/Hinglish names mapped to the English names recipe search understands.
const HINDI_ALIASES = {
  tamatar: 'tomato', pyaz: 'onion', pyaaz: 'onion', kanda: 'onion', aloo: 'potato', aaloo: 'potato',
  adrak: 'ginger', lehsun: 'garlic', lahsun: 'garlic', gobi: 'cauliflower', 'phool gobi': 'cauliflower',
  'patta gobi': 'cabbage', matar: 'peas', dhaniya: 'coriander', pudina: 'mint', mirchi: 'green chilli',
  'hari mirch': 'green chilli', 'lal mirch': 'red chilli', 'shimla mirch': 'capsicum', nimbu: 'lemon',
  baingan: 'brinjal', gajar: 'carrot', kheera: 'cucumber', palak: 'spinach', methi: 'fenugreek',
  bhindi: 'okra', lauki: 'bottle gourd', karela: 'bitter gourd', namak: 'salt', chini: 'sugar', gud: 'jaggery',
  haldi: 'turmeric', jeera: 'cumin', rai: 'mustard seeds', chawal: 'rice', doodh: 'milk', dahi: 'curd',
  makhan: 'butter', anda: 'egg', ande: 'egg', murgi: 'chicken', murga: 'chicken', machli: 'fish', machhli: 'fish',
};

const SPELLING_VARIANTS = {
  chili: 'chilli', chilies: 'chilli', chillies: 'chilli', chilis: 'chilli',
  yoghurt: 'yogurt', dhal: 'dal', daal: 'dal', panir: 'paneer',
};

// Words that carry quantity or phrasing, never an ingredient (English + common Hinglish).
const STOP_WORDS = new Set([
  'i', 'have', "i've", 'got', 'we', 'there', 'is', 'are', 'some', 'a', 'an', 'the', 'few', 'little', 'of',
  'also', 'plus', 'with', 'and', 'my', 'in', 'fridge', 'kitchen', 'me', 'just', 'only', 'um', 'uh', 'like',
  'maybe', 'about', 'around', 'more', 'then', 'ok', 'okay', 'so', 'it', 'its', 'this', 'that', 'these',
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'half', 'dozen',
  'kg', 'g', 'gram', 'grams', 'litre', 'litres', 'liter', 'liters', 'ml', 'piece', 'pieces', 'packet',
  'packets', 'bunch', 'bunches', 'cup', 'cups', 'bowl', 'can', 'tin',
  'aur', 'thoda', 'thodi', 'kuch', 'mere', 'paas', 'hai', 'hain', 'ka', 'ki', 'ke', 'bhi', 'aadha',
]);

const MAX_PHRASE_WORDS = 3;
const MAX_MODIFIER_WORDS = 2;

const VOCABULARY = new Map([
  ...ENGLISH_INGREDIENTS.map((name) => [name, name]),
  ...Object.entries(HINDI_ALIASES),
]);

function canonicalWord(word) {
  if (SPELLING_VARIANTS[word]) return SPELLING_VARIANTS[word];
  if (VOCABULARY.has(word)) return word;
  if (word.endsWith('es') && VOCABULARY.has(word.slice(0, -2))) return word.slice(0, -2);
  if (word.endsWith('s') && VOCABULARY.has(word.slice(0, -1))) return word.slice(0, -1);
  return word;
}

function matchAt(tokens, start) {
  for (let length = Math.min(MAX_PHRASE_WORDS, tokens.length - start); length > 0; length -= 1) {
    const phrase = tokens.slice(start, start + length).map(canonicalWord).join(' ');
    if (VOCABULARY.has(phrase)) {
      return { name: VOCABULARY.get(phrase), length };
    }
  }

  return null;
}

function segmentChunk(chunk) {
  const tokens = chunk.split(' ').filter(Boolean);
  const items = [];
  let buffer = [];

  const flushBuffer = () => {
    if (buffer.length) items.push(buffer.join(' '));
    buffer = [];
  };

  for (let index = 0; index < tokens.length;) {
    const token = tokens[index];

    if (STOP_WORDS.has(token) || /^\d/.test(token)) {
      flushBuffer();
      index += 1;
      continue;
    }

    const match = matchAt(tokens, index);
    if (!match) {
      buffer.push(token);
      index += 1;
      continue;
    }

    if (buffer.length && buffer.length <= MAX_MODIFIER_WORDS) {
      items.push(`${buffer.join(' ')} ${match.name}`);
      buffer = [];
    } else {
      flushBuffer();
      items.push(match.name);
    }

    index += match.length;
  }

  flushBuffer();
  return items;
}

export function extractIngredientsFromTranscript(transcript) {
  const chunks = String(transcript || '')
    .toLowerCase()
    .split(/[,;.&]|\band\b|\baur\b|\bplus\b|\bwith\b/)
    .map((chunk) => chunk.replace(/[^a-z0-9\s'-]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  return Array.from(new Set(chunks.flatMap(segmentChunk)));
}
