import type { StandingsResponse } from './types'

// In dev we use a same-origin proxy to avoid CORS; the server adds the API token.
const BASE =
  import.meta.env.DEV
    ? '/api/football/v4'
    : 'https://api.football-data.org/v4'
const PREMIER_LEAGUE = 'PL'

function getHeaders(): HeadersInit {
  const headers: HeadersInit = { Accept: 'application/json' }
  // Only send token when calling API directly (production build); in dev the proxy adds it
  if (!import.meta.env.DEV) {
    const token = import.meta.env.VITE_FOOTBALL_DATA_API_KEY
    if (token) headers['X-Auth-Token'] = token
  }
  return headers
}

/** Fetch Premier League standings. Season is the start year (e.g. 2023 for 2023/24). */
export async function fetchPremierLeagueStandings(season?: number): Promise<StandingsResponse> {
  const sp = new URLSearchParams()
  if (season != null) sp.set('season', String(season))
  const qs = sp.toString()
  const url = `${BASE}/competitions/${PREMIER_LEAGUE}/standings${qs ? `?${qs}` : ''}`
  const res = await fetch(url, { headers: getHeaders() })
  const text = await res.text()
  if (!res.ok) {
    let message = text
    try {
      const json = JSON.parse(text) as { message?: string; error?: string }
      message = json.message ?? json.error ?? text
    } catch {
      // use raw text
    }
    throw new Error(`API ${res.status}: ${message}`)
  }
  return JSON.parse(text) as StandingsResponse
}

/** For debugging: whether the env key is set (Vite inlines this at build time). */
export function isApiKeyConfigured(): boolean {
  return Boolean(import.meta.env.VITE_FOOTBALL_DATA_API_KEY)
}
