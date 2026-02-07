import type { StandingsResponse, TableEntry } from './types'

function TeamCrest({ team }: { team: TableEntry['team'] }) {
  const src = team.crest
  if (!src) return null
  return (
    <img
      src={src}
      alt=""
      className="crest"
      loading="lazy"
      onError={(e) => (e.currentTarget.style.display = 'none')}
    />
  )
}

export function StandingsTable({ data }: { data: StandingsResponse }) {
  const totalStanding = data.standings?.find((s) => s.type === 'TOTAL')
  const table = totalStanding?.table ?? []
  const season = data.season

  return (
    <section className="standings-section">
      <header className="section-header">
        <h2>League Table</h2>
        {season && (
          <span className="season-badge">
            {new Date(season.startDate).getFullYear()}/
            {String(new Date(season.endDate).getFullYear()).slice(2)}
          </span>
        )}
      </header>
      <div className="table-wrap">
        <table className="standings-table">
          <thead>
            <tr>
              <th>#</th>
              <th className="team-col">Club</th>
              <th>P</th>
              <th>W</th>
              <th>D</th>
              <th>L</th>
              <th>GF</th>
              <th>GA</th>
              <th className="gd-col">GD</th>
              <th className="pts-col">Pts</th>
            </tr>
          </thead>
          <tbody>
            {table.map((row) => (
              <tr key={row.team.id}>
                <td className="pos">{row.position}</td>
                <td className="team-col">
                  <TeamCrest team={row.team} />
                  <span className="team-name">{row.team.name}</span>
                </td>
                <td>{row.playedGames}</td>
                <td>{row.won}</td>
                <td>{row.draw}</td>
                <td>{row.lost}</td>
                <td>{row.goalsFor}</td>
                <td>{row.goalsAgainst}</td>
                <td className="gd-col">{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}</td>
                <td className="pts-col">{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
