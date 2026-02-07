# Premier League Standings

A website that shows **league standings** for the Premier League with a **season selector** to view the last 5 years.

## Features

- **League table** – Full Premier League standings (P, W, D, L, GF, GA, GD, Pts)
- **Season dropdown** – Choose from the current season and the previous 4 seasons (5 years of data)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **API key (recommended)**

   The app uses [football-data.org](https://www.football-data.org/). Free tier allows 10 requests per minute.

   - Sign up at https://www.football-data.org/
   - Copy `.env.example` to `.env`
   - Set `VITE_FOOTBALL_DATA_API_KEY` to your token

   Without a key, the API may only allow limited access, so standings might not load.

3. **Run the app**

   ```bash
   npm run dev
   ```

   Open the URL shown (e.g. http://localhost:5173).

## Build

```bash
npm run build
npm run preview
```

## Tech

- **Vite** + **React** + **TypeScript**
- **football-data.org v4** for Premier League standings (with `season` filter for historical years)
