// POST /functions/v1/submit-score
// Body (JSON or form): { token, text, clip? (clipboard fallback), day? (YYYY-MM-DD, the phone's local date) }
// Called by the iOS Shortcut. Auth is the personal share token, not a Supabase JWT,
// so this function is deployed with verify_jwt = false (see supabase/config.toml).
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { parseShare, getGame } from '../_shared/games.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, authorization, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

async function readBody(req: Request): Promise<Record<string, string>> {
  const type = req.headers.get('content-type') ?? '';
  if (type.includes('application/json')) return await req.json();
  if (type.includes('form')) return Object.fromEntries((await req.formData()).entries()) as Record<string, string>;
  return { text: await req.text(), token: new URL(req.url).searchParams.get('token') ?? '' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { ok: false, message: 'Use POST' });

  let body: Record<string, string>;
  try { body = await readBody(req); } catch { return reply(400, { ok: false, message: 'Could not read the request.' }); }
  const token = String(body.token ?? '').trim();
  const text = String(body.text ?? '').slice(0, 2000);
  if (!token) return reply(401, { ok: false, message: 'Missing token. Copy it from Bragboard → Me → iPhone.' });

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const { data: tok } = await db.from('share_tokens').select('user_id').eq('token', token).maybeSingle();
  if (!tok) return reply(401, { ok: false, message: 'That token is not valid any more. Copy a fresh one from Bragboard → Me.' });
  const userId = tok.user_id as string;

  // Some games' Share buttons hand the Shortcut only a link, not the result text. The Shortcut
  // also sends the clipboard as `clip`; use it only when the shared text itself can't be read.
  const clip = String(body.clip ?? '').slice(0, 2000);
  let parsed = parseShare(text);
  let raw = text;
  if (!parsed && clip) { parsed = parseShare(clip); raw = clip; }
  if (!parsed) return reply(422, { ok: false, message: 'Bragboard didn’t recognise that result. Open the app and enter it by hand.' });
  const game = getGame(parsed.gameId)!;

  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(body.day ?? '')) ? String(body.day) : new Date().toISOString().slice(0, 10);

  const { data: existing } = await db.from('scores').select('display')
    .eq('user_id', userId).eq('game_id', parsed.gameId).eq('day', day).maybeSingle();
  if (existing) {
    return reply(200, { ok: true, duplicate: true, message: `Already posted ${game.name} today (${existing.display}).` });
  }

  const { error } = await db.from('scores').insert({
    user_id: userId, game_id: parsed.gameId, day, score: parsed.score, points: parsed.points,
    display: parsed.display, failed: Boolean(parsed.failed), puzzle: parsed.puzzle ?? null,
    meta: parsed.meta ?? {}, raw, source: 'shortcut',
  });
  if (error) return reply(500, { ok: false, message: `Could not save: ${error.message}` });

  // Rank in each league that plays this game.
  const { data: mems } = await db.from('league_members').select('league_id, leagues(name, games)').eq('user_id', userId);
  const lines: string[] = [];
  for (const m of mems ?? []) {
    // deno-lint-ignore no-explicit-any
    const lg = (m as any).leagues as { name: string; games: string[] } | null;
    if (!lg || !lg.games.includes(parsed.gameId)) continue;
    const { data: ids } = await db.from('league_members').select('user_id').eq('league_id', m.league_id);
    const { data: today } = await db.from('scores').select('user_id, points')
      .eq('game_id', parsed.gameId).eq('day', day).in('user_id', (ids ?? []).map((r) => r.user_id));
    const better = (today ?? []).filter((s) => Number(s.points) > parsed.points).length;
    lines.push(`#${better + 1} of ${(today ?? []).length} in ${lg.name}`);
  }

  return reply(200, {
    ok: true,
    game: game.name,
    display: parsed.display,
    message: `${game.emoji} ${game.name} ${parsed.display} posted!` + (lines.length ? `\n${lines.join('\n')}` : ''),
  });
});
