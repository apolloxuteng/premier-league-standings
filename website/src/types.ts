// football-data.org v4 API types (Premier League standings)

export interface TeamRef {
  id: number
  name: string
  shortName?: string
  crest?: string
}

export interface TableEntry {
  position: number
  team: TeamRef
  playedGames: number
  won: number
  draw: number
  lost: number
  points: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
}

export interface StandingGroup {
  stage: string
  type: string
  group: string | null
  table: TableEntry[]
}

export interface StandingsResponse {
  filters: Record<string, unknown>
  area: { id: number; name: string; code: string }
  competition: { id: number; name: string; code: string }
  season: { id: number; startDate: string; endDate: string; currentMatchday: number | null }
  standings: StandingGroup[]
}
