// Central API Helper for StudyBuddy
// Manages JWT token in localStorage and injects Authorization header into all /api requests

const TOKEN_KEY = 'studybuddy_token'

let unauthorizedCallback = null

export function setUnauthorizedCallback(callback) {
  unauthorizedCallback = callback
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY)
}

/**
 * Safely parse JSON from a fetch Response without throwing
 * "Unexpected end of JSON input" on empty responses, HTML error pages, or proxy dropouts.
 */
export async function parseResponseJson(response) {
  if (!response) return {}
  try {
    const text = await response.text()
    if (!text || !text.trim()) {
      return {}
    }
    return JSON.parse(text)
  } catch (err) {
    return { detail: 'Unexpected response format from server.' }
  }
}

/**
 * Central fetch wrapper:
 * - Uses relative URLs (proxied by Vite to http://127.0.0.1:8000)
 * - Injects 'Authorization: Bearer <token>' header automatically
 * - On 401 Unauthorized (unless logging in), clears token and redirects to Auth Screen
 */
export async function apiFetch(endpoint, options = {}) {
  const token = getToken()
  const headers = { ...(options.headers || {}) }

  // Set default JSON Content-Type if payload exists and not FormData
  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  // Inject Authorization Bearer token if present
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  })

  // On 401 Unauthorized, automatically log out and return to auth screen
  // (except on explicit login/signup attempts where 401 is an expected credential error)
  if (response.status === 401 && !endpoint.includes('/api/auth/login') && !endpoint.includes('/api/auth/signup')) {
    removeToken()
    if (unauthorizedCallback) {
      unauthorizedCallback()
    }
  }

  return response
}

export const authApi = {
  async signup(email, password) {
    const res = await apiFetch('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    const data = await parseResponseJson(res)
    if (!res.ok) {
      throw new Error(data.detail || `Signup failed (HTTP ${res.status})`)
    }
    setToken(data.access_token)
    return data
  },

  async login(email, password) {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    const data = await parseResponseJson(res)
    if (!res.ok) {
      throw new Error(data.detail || `Login failed (HTTP ${res.status})`)
    }
    setToken(data.access_token)
    return data
  },

  async guest() {
    const res = await apiFetch('/api/auth/guest', {
      method: 'POST',
    })
    const data = await parseResponseJson(res)
    if (!res.ok) {
      throw new Error(data.detail || `Guest session creation failed (HTTP ${res.status})`)
    }
    setToken(data.access_token)
    return data
  },

  async getMe() {
    const res = await apiFetch('/api/auth/me')
    if (!res.ok) {
      throw new Error('Not authenticated')
    }
    return await parseResponseJson(res)
  },

  logout() {
    removeToken()
    if (unauthorizedCallback) {
      unauthorizedCallback()
    }
  },
}
