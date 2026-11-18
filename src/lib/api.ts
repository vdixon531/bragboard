import { supabase } from './supabase';
import type { League, Member, Profile, Score } from './types';
import type { ParseResult } from '@shared/games';

function must<T>(r: { data: unknown; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}
const numeric = (r: Score): Score => ({ ...r, score: Number(r.score), points: Number(r.points) });

export async function getProfile(id: string): Promise<Profile | null> {
  return must(await supabase.from('profiles').select('*').eq('id', id).maybeSingle());
}
export async function updateProfile(id: string, patch: Partial<Profile>) {
  must(await supabase.from('profiles').update(patch).eq('id', id));
}

export async function myLeagues(userId: string): Promise<League[]> {
  const rows = must<{ leagues: League | null }[]>(
    await supabase.from('league_members').select('leagues(*)').eq('user_id', userId),
  );
  return rows
    .map((r) => r.leagues)
    .filter((l): l is League => Boolean(l))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}
export async function getLeague(id: string): Promise<League | null> {
  return must(await supabase.from('leagues').select('*').eq('id', id).maybeSingle());
}
export async function leagueMembers(id: string): Promise<Member[]> {
  const rows = must<Member[]>(
    await supabase.from('league_members').select('user_id, role, joined_at, profile:profiles(*)').eq('league_id', id),
  );
  return rows.filter((m) => m.profile).sort((a, b) => a.joined_at.localeCompare(b.joined_at));
}
export async function createLeague(name: string, games: string[], theme: string): Promise<League> {
  return must(await supabase.rpc('create_league', { p_name: name, p_games: games, p_theme: theme }));
}
export async function joinLeague(code: string): Promise<League> {
  return must(await supabase.rpc('join_league', { p_code: code }));
}
export async function peekLeague(code: string) {
  const rows = must<{ id: string; name: string; theme: string; games: string[]; members: number }[]>(
    await supabase.rpc('peek_league', { p_code: code }),
  );
  return rows[0] ?? null;
}
export async function updateLeague(id: string, patch: Partial<Pick<League, 'name' | 'games' | 'theme'>>) {
  must(await supabase.from('leagues').update(patch).eq('id', id));
}
export async function deleteLeague(id: string) {
  must(await supabase.from('leagues').delete().eq('id', id));
}
export async function removeMember(leagueId: string, userId: string) {
  must(await supabase.from('league_members').delete().eq('league_id', leagueId).eq('user_id', userId));
}

/** All scores for these people and games since `from`. Pages past Supabase's 1000-row cap. */
export async function scoresFor(userIds: string[], games: string[], from: string): Promise<Score[]> {
  if (!userIds.length || !games.length) return [];
  const out: Score[] = [];
  for (let page = 0; page < 50; page++) {
    const rows = must<Score[]>(
      await supabase.from('scores').select('*')
        .in('user_id', userIds).in('game_id', games).gte('day', from)
        .order('day', { ascending: false }).order('id')
        .range(page * 1000, page * 1000 + 999),
    );
    out.push(...rows.map(numeric));
    if (rows.length < 1000) break;
  }
  return out;
}
export async function myScoresOn(userId: string, day: string): Promise<Score[]> {
  return must<Score[]>(await supabase.from('scores').select('*').eq('user_id', userId).eq('day', day)).map(numeric);
}

export type SubmitOutcome = { status: 'posted'; score: Score } | { status: 'duplicate'; existing: Score };

export async function submitScore(
  userId: string, r: ParseResult, day: string, raw: string, replace = false,
): Promise<SubmitOutcome> {
  if (!replace) {
    const ex = must<Score | null>(
      await supabase.from('scores').select('*').eq('user_id', userId).eq('game_id', r.gameId).eq('day', day).maybeSingle(),
    );
    if (ex) return { status: 'duplicate', existing: numeric(ex) };
  }
  const row = {
    user_id: userId, game_id: r.gameId, day, score: r.score, points: r.points, display: r.display,
    failed: Boolean(r.failed), puzzle: r.puzzle ?? null, meta: r.meta ?? {}, raw: raw.slice(0, 2000),
    source: r.meta?.manual ? 'manual' : 'app',
  };
  const saved = must<Score>(
    await supabase.from('scores').upsert(row, { onConflict: 'user_id,game_id,day' }).select('*').single(),
  );
  return { status: 'posted', score: numeric(saved) };
}
export async function deleteScore(id: number) {
  must(await supabase.from('scores').delete().eq('id', id));
}

export async function getShareToken(): Promise<string | null> {
  const r = await supabase.from('share_tokens').select('token').maybeSingle();
  return (r.data?.token as string | undefined) ?? null;
}
export async function rotateShareToken(): Promise<string> {
  return must<string>(await supabase.rpc('rotate_share_token'));
}
