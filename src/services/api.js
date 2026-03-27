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

function formatNetworkError(error, url) {
  const message = String(error?.message || '');

  if (/network request failed|fetch failed|failed to fetch/i.test(message)) {
    return `Cannot reach API at ${url}. Make sure the Express server is running and your phone and laptop are on the same Wi-Fi.`;
  }

  return message || 'Request failed';
}

export async function fetchFavorites(userId) {
  const url = buildUrl('/favorites', { userId });

  try {
    const response = await fetch(url);
    return parseResponse(response);
  } catch (error) {
    throw new Error(formatNetworkError(error, url));
  }
}

export async function createFavorite(payload) {
  const url = buildUrl('/favorites');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return parseResponse(response);
  } catch (error) {
    throw new Error(formatNetworkError(error, url));
  }
}

export async function fetchHistory(userId) {
  const url = buildUrl('/history', { userId });

  try {
    const response = await fetch(url);
    return parseResponse(response);
  } catch (error) {
    throw new Error(formatNetworkError(error, url));
  }
}

export async function createHistory(payload) {
  const url = buildUrl('/history');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    return parseResponse(response);
  } catch (error) {
    throw new Error(formatNetworkError(error, url));
  }
}
