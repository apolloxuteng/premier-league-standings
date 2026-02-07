import { useEffect, useState } from 'react'
import { fetchPremierLeagueStandings, isApiKeyConfigured } from './api'
import type { StandingsResponse } from './types'
import { StandingsTable } from './StandingsTable'
import './App.css'

const PREMIER_LEAGUE = 'Premier League'
const YEARS_BACK = 5

function getSeasonYears(): number[] {
  const currentYear = new Date().getFullYear()
  const month = new Date().getMonth()
  // Season starts Aug; if we're before August, current season started last year
  const currentSeasonStart = month < 7 ? currentYear - 1 : currentYear
  const years: number[] = []
  for (let i = 0; i < YEARS_BACK; i++) {
    years.push(currentSeasonStart - i)
  }
  return years
}

const SEASON_YEARS = getSeasonYears()

export default function App() {
  const [selectedYear, setSelectedYear] = useState<number>(SEASON_YEARS[0])
  const [standings, setStandings] = useState<StandingsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchPremierLeagueStandings(selectedYear)
      .then((res) => {
        if (!cancelled) {
          setStandings(res)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load standings')
          setStandings(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [selectedYear])

  return (
    <div className="app">
      <header className="app-header">
        <h1>{PREMIER_LEAGUE}</h1>
        <p className="tagline">League standings</p>
      </header>
      <main className="app-main">
        <div className="controls">
          <label htmlFor="season-year">Season</label>
          <select
            id="season-year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="year-select"
          >
            {SEASON_YEARS.map((y) => (
              <option key={y} value={y}>
                {y} / {String(y + 1).slice(2)}
              </option>
            ))}
          </select>
        </div>
        {!isApiKeyConfigured() && (
          <div className="error-msg">
            API key not loaded. Add VITE_FOOTBALL_DATA_API_KEY to .env and restart the dev server (npm run dev).
          </div>
        )}
        {error && <div className="error-msg">{error}</div>}
        {loading && !standings ? (
          <div className="loading">Loading standings…</div>
        ) : standings ? (
          <StandingsTable data={standings} />
        ) : null}
      </main>
      <footer className="app-footer">
        Data from{' '}
        <a href="https://www.football-data.org" target="_blank" rel="noopener noreferrer">
          football-data.org
        </a>
      </footer>
    </div>
  )
}
