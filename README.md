# Bragboard

Daily-game leagues for you and your friends. Finish MapTap, Krillion, Wordle or any game on the card, tap **Share**, and your score lands on the league leaderboard, followed by a little celebration.

- **Web app (PWA)** hosted on your domain. It works in any browser and installs to the home screen.
- **Android:** once installed, Bragboard appears in the system share sheet.
- **iPhone:** a Shortcut in the share sheet posts the score in one tap (Apple doesn't allow web apps in the share sheet).
- **Supabase** for login (email link or 6-digit code), the database, and live updates.

## Setup (about 20 minutes, once)

### 1. Supabase project
1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor** → paste all of `supabase/migrations/0001_init.sql` → Run.
3. **Authentication → URL Configuration**
   - Site URL: `https://your-domain.com`
   - Redirect URLs: add `https://your-domain.com/login` and `http://localhost:5173/login`
4. **Authentication → Email Templates → Magic Link**: add the code to the email so people using the home-screen app can type it in (iOS opens email links in Safari, not the installed app):
   ```html
   <h2>Your Bragboard sign-in</h2>
   <p>Your code: <strong>{{ .Token }}</strong></p>
   <p>Or <a href="{{ .ConfirmationURL }}">tap here to sign in</a>.</p>
   ```
5. The built-in email sender only allows a few messages an hour. For a group, set up custom SMTP (for example Resend's free tier) under **Project Settings → Auth → SMTP**.

### 2. Deploy the share function (used by the iPhone Shortcut)
```bash
npm i -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy submit-score --no-verify-jwt
```

### 3. Web app
```bash
cp .env.example .env      # fill in URL + anon key from Project Settings → API
npm install
npm run dev               # http://localhost:5173
```

### 4. Deploy to your domain
Any static host works. Build command `npm run build`, output folder `dist`, and set the two `VITE_SUPABASE_*` environment variables in the host's dashboard.
- **Vercel:** `vercel.json` already rewrites routes to the app.
- **Netlify / Cloudflare Pages:** `public/_redirects` handles it.

It must be served over **HTTPS**, which Android needs before it will install the app or offer the share target.

## How sharing works

| | Steps |
|---|---|
| **Android** | Open the site in Chrome → menu → *Install app*. Then, in any game: Share → **Bragboard**. |
| **iPhone** | Me → iPhone tab has your token and step-by-step setup. Build the Shortcut once, share its iCloud link with the group, and add an *Import Question* for the token so each friend pastes their own. |
| **Anywhere** | Copy the result, open Bragboard → **Post** → *Paste from clipboard*. Manual entry is there too. |

## Scoring
- Each game's raw score is turned into **0–100 league points** (`points` in `supabase/functions/_shared/games.ts`), so games with different scales can be added together. Wordle 3/6 = 75, MapTap 812 = 81, Connections with one mistake = 80, and so on.
- League tables (day / week / month / all-time) sum those points. A **win** is first place in a game that at least two people played that day.
- Scores belong to the player, not the league, so one share counts in every league that plays that game. One score per game per day; you can replace it if you posted the wrong one.

## Awards
Defined in `src/lib/awards.ts`: Daily Crown, Clean Sweep, Player of the Week, Early Bird, Night Owl, Wooden Spoon, streaks (3/7/30/100 days), and per-game ones such as Atlas Brain (MapTap 950+), One in a Krillion (600+), Purple Reign, First Try (solved on guess one) and Bricked It (X/6).

## Adding or fixing a game
Everything is in **`supabase/functions/_shared/games.ts`**, which the app and the Edge Function both import:
1. Add a `GameDef` (name, emoji, colours/motif, `detect`, `parse`, `points`).
2. Add a real share text to `tests/games.test.ts` and run `npm test`.
3. Redeploy the function (`supabase functions deploy submit-score --no-verify-jwt`) and the site.

**Krillion, Yeastimate and Plane use best-guess parsers** until we have real share texts. They're marked "format pending" in the app, and manual entry works for them today.

## Dev
- `npm test` runs the parser, standings and awards tests.
- `http://localhost:5173/demo?game=maptap` previews the celebration screen for any game (dev only).
- `npm run icons` regenerates the PWA icons.
