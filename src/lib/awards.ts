import type { Score } from './types';
import { rankBoard } from './standings';
import { addDays, weekStart } from './dates';

export interface AwardInfo { emoji: string; title: string; desc: string; tone: 'gold' | 'fun' | 'fire' | 'shame' }
export interface Award { id: string; key: string; userId: string; day: string; gameId?: string }

export const AWARDS: Record<string, AwardInfo> = {
  crown:        { emoji: '👑', title: 'Daily Crown', desc: 'Most points in the league today', tone: 'gold' },
  sweep:        { emoji: '🧹', title: 'Clean Sweep', desc: 'Won every game on the card', tone: 'gold' },
  mvp:          { emoji: '🏆', title: 'Player of the Week', desc: 'Top of the weekly table', tone: 'gold' },
  early:        { emoji: '🐦', title: 'Early Bird', desc: 'First to post today', tone: 'fun' },
  owl:          { emoji: '🦉', title: 'Night Owl', desc: 'Posted between midnight and 4am', tone: 'fun' },
  spoon:        { emoji: '🥄', title: 'Wooden Spoon', desc: 'Played the full card, finished last', tone: 'shame' },
  ace:          { emoji: '🎯', title: 'First Try', desc: 'Solved it on guess one', tone: 'gold' },
  birdie:       { emoji: '🐤', title: 'Birdie', desc: 'Wordle in two', tone: 'fun' },
  bricked:      { emoji: '🧱', title: 'Bricked It', desc: 'X/6. It happens.', tone: 'shame' },
  purple:       { emoji: '💜', title: 'Purple Reign', desc: 'Perfect Connections, purple first', tone: 'gold' },
  flawless:     { emoji: '🧩', title: 'Flawless Grid', desc: 'Connections with zero mistakes', tone: 'fun' },
  nohints:      { emoji: '🧵', title: 'No Hints Needed', desc: 'Strands without a single hint', tone: 'fun' },
  globetrotter: { emoji: '🌍', title: 'Globetrotter', desc: 'MapTap 900+', tone: 'fun' },
  atlas:        { emoji: '🧠', title: 'Atlas Brain', desc: 'MapTap 950+', tone: 'gold' },
  krill:        { emoji: '🦐', title: 'One in a Krillion', desc: 'Krillion 600+ points (6,000m deep)', tone: 'gold' },
  speed:        { emoji: '⚡', title: 'Speed Demon', desc: 'The Mini in under 30 seconds', tone: 'fun' },
  timelord:     { emoji: '⏳', title: 'Time Lord', desc: 'TimeGuessr 45,000+', tone: 'gold' },
  bullseye:     { emoji: '🌐', title: 'Bullseye Planet', desc: 'Globle in two or fewer', tone: 'fun' },
  proof:        { emoji: '🍞', title: 'Proof Positive', desc: 'Near-perfect Yeastimate', tone: 'fun' },
  topgun:       { emoji: '🛩️', title: 'Top Gun', desc: 'Near-perfect Plane', tone: 'fun' },
  streak3:      { emoji: '🔥', title: '3-Day Streak', desc: 'Posted three days running', tone: 'fire' },
  streak7:      { emoji: '🔥', title: 'Week Warrior', desc: 'Seven-day posting streak', tone: 'fire' },
  streak30:     { emoji: '☄️', title: 'Monthly Menace', desc: '30-day posting streak', tone: 'fire' },
  streak100:    { emoji: '💯', title: 'Centurion', desc: '100-day posting streak', tone: 'fire' },
};

/** Achievements earned by a single score, no league context needed. */
export function scoreAwardKeys(s: Score): string[] {
  const m = s.meta ?? {};
  switch (s.game_id) {
    case 'wordle':
      if (s.failed) return ['bricked'];
      if (s.score === 1) return ['ace'];
      if (s.score === 2) return ['birdie'];
      return [];
    case 'worldle':
    case 'framed':
      return !s.failed && s.score === 1 ? ['ace'] : [];
    case 'connections':
      if (s.failed || s.score !== 0) return [];
      return m.purpleFirst ? ['purple'] : ['flawless'];
    case 'strands': return s.score === 0 ? ['nohints'] : [];
    case 'maptap': return s.score >= 950 ? ['atlas'] : s.score >= 900 ? ['globetrotter'] : [];
    case 'krillion': return s.score >= 600 ? ['krill'] : [];
    case 'mini': return s.score < 30 ? ['speed'] : [];
    case 'timeguessr': return s.score >= 45000 ? ['timelord'] : [];
    case 'globle': return s.score <= 2 ? ['bullseye'] : [];
    case 'yeastimate': return s.points >= 90 ? ['proof'] : [];
    case 'plane': return s.points >= 90 ? ['topgun'] : [];
    default: return [];
  }
}

const STREAK_MILESTONES: [number, string][] = [[3, 'streak3'], [7, 'streak7'], [30, 'streak30'], [100, 'streak100']];

/** Every award the league has earned in these scores, newest first. */
export function leagueAwards(scores: Score[], memberIds: string[], games: string[], todayStr: string): Award[] {
  const members = new Set(memberIds);
  const mine = scores.filter((s) => members.has(s.user_id) && games.includes(s.game_id));
  const out: Award[] = [];
  const push = (key: string, userId: string, day: string, gameId?: string) =>
    out.push({ id: `${key}|${userId}|${day}|${gameId ?? ''}`, key, userId, day, gameId });

  for (const s of mine) for (const k of scoreAwardKeys(s)) push(k, s.user_id, s.day, s.game_id);

  const byDay = new Map<string, Score[]>();
  for (const s of mine) byDay.set(s.day, [...(byDay.get(s.day) ?? []), s]);

  for (const [day, list] of byDay) {
    const players = [...new Set(list.map((s) => s.user_id))];
    // Night Owl: posted between midnight and 4am (viewer's clock), once per person per day
    const owls = new Set(list.filter((s) => new Date(s.created_at).getHours() < 4).map((s) => s.user_id));
    for (const u of owls) push('owl', u, day);
    if (players.length < 2) continue;

    const first = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
    push('early', first.user_id, day);

    const totals = new Map<string, number>();
    for (const s of list) totals.set(s.user_id, (totals.get(s.user_id) ?? 0) + s.points);
    const best = Math.max(...totals.values());
    for (const [u, t] of totals) if (t === best) push('crown', u, day);

    // Sweep: 1st in every league game played by 2+ people that day (needs 2+ such games)
    const contested = games.map((g) => rankBoard(list.filter((s) => s.game_id === g))).filter((b) => b.length >= 2);
    if (contested.length >= 2) {
      for (const u of players) if (contested.every((b) => b.some((r) => r.rank === 1 && r.score.user_id === u))) push('sweep', u, day);
    }

    // Wooden spoon: 3+ people played the full card, lowest total among them
    const full = players.filter((u) => games.every((g) => list.some((s) => s.user_id === u && s.game_id === g)));
    if (full.length >= 3 && games.length >= 2) {
      const worst = Math.min(...full.map((u) => totals.get(u) ?? 0));
      const losers = full.filter((u) => totals.get(u) === worst);
      if (losers.length === 1) push('spoon', losers[0], day);
    }
  }

  // Posting streaks, awarded on the day the milestone was hit
  for (const u of memberIds) {
    const days = [...new Set(mine.filter((s) => s.user_id === u).map((s) => s.day))].sort();
    let run = 0, prev = '';
    for (const d of days) {
      run = prev && addDays(prev, 1) === d ? run + 1 : 1;
      prev = d;
      for (const [n, key] of STREAK_MILESTONES) if (run === n) push(key, u, d);
    }
  }

  // Player of the week for every finished week
  const thisWeek = weekStart(todayStr);
  const weeks = new Map<string, Map<string, number>>();
  for (const s of mine) {
    const w = weekStart(s.day);
    if (w >= thisWeek) continue;
    const m = weeks.get(w) ?? new Map<string, number>();
    m.set(s.user_id, (m.get(s.user_id) ?? 0) + s.points);
    weeks.set(w, m);
  }
  for (const [w, totals] of weeks) {
    if (totals.size < 2) continue;
    const best = Math.max(...totals.values());
    for (const [u, t] of totals) if (t === best) push('mvp', u, addDays(w, 6));
  }

  const order = (k: string) => (AWARDS[k]?.tone === 'gold' ? 0 : AWARDS[k]?.tone === 'fire' ? 1 : 2);
  return out.sort((a, b) => b.day.localeCompare(a.day) || order(a.key) - order(b.key));
}
