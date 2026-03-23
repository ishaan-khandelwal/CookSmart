const API_URL = process.env.EXPO_PUBLIC_API_URL;

function buildUrl(path, query = {}) {
  if (!API_URL) {
    throw new Error('EXPO_PUBLIC_API_URL is not configured');
  }

  const normalizedBaseUrl = API_URL.replace(/\/$/, '');
  const searchParams = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return `${normalizedBaseUrl}${path}${queryString ? `?${queryString}` : ''}`;
}

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
}

export async function fetchFavorites(userId) {
  const response = await fetch(buildUrl('/favorites', { userId }));
  return parseResponse(response);
}

export async function createFavorite(payload) {
  const response = await fetch(buildUrl('/favorites'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(response);
}
