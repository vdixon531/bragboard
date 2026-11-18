import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { GAMES, getGame, manualScore, parseShare, type ParseResult } from '@shared/games';
import { useAuth } from '../lib/auth';
import { myLeagues, scoresFor, submitScore, leagueMembers } from '../lib/api';
import { today } from '../lib/dates';
import { rankBoard } from '../lib/standings';
import { scoreAwardKeys } from '../lib/awards';
import type { Score } from '../lib/types';
import { Celebration } from '../components/Celebration';
import { Shell, Spinner, GameChip, gameVars } from '../components/ui';

interface LeagueRank { id: string; name: string; rank: number; of: number }

type State =
  | { kind: 'input' }
  | { kind: 'posting' }
  | { kind: 'duplicate'; parsed: ParseResult; existing: Score; raw: string }
  | { kind: 'done'; score: Score & { awardKeys: string[] }; ranks: LeagueRank[] }
  | { kind: 'error'; message: string };

export default function Post() {
  const { session } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [text, setText] = useState('');
  const [state, setState] = useState<State>({ kind: 'input' });
  const [manualGame, setManualGame] = useState('maptap');
  const [manualValue, setManualValue] = useState('');
  const [manualFailed, setManualFailed] = useState(false);
  const [pasteNote, setPasteNote] = useState('');
  const autoRan = useRef(false);
  const day = today();

  const parsed = useMemo(() => parseShare(text), [text]);

  async function rankIn(score: Score): Promise<LeagueRank[]> {
    if (!session) return [];
    const leagues = (await myLeagues(session.user.id)).filter((l) => l.games.includes(score.game_id));
    return Promise.all(leagues.map(async (l) => {
      const ids = (await leagueMembers(l.id)).map((m) => m.user_id);
      const board = rankBoard((await scoresFor(ids, [score.game_id], score.day)).filter((s) => s.day === score.day));
      const me = board.find((r) => r.score.user_id === session.user.id);
      return { id: l.id, name: l.name, rank: me?.rank ?? board.length, of: board.length };
    }));
  }

  async function post(p: ParseResult, raw: string, replace = false) {
    if (!session) return;
    setState({ kind: 'posting' });
    try {
      const out = await submitScore(session.user.id, p, day, raw, replace);
      if (out.status === 'duplicate') { setState({ kind: 'duplicate', parsed: p, existing: out.existing, raw }); return; }
      const ranks = await rankIn(out.score);
      setState({ kind: 'done', score: { ...out.score, awardKeys: scoreAwardKeys(out.score) }, ranks });
    } catch (e) {
      setState({ kind: 'error', message: (e as Error).message });
    }
  }

  // Arrived from the Android share sheet (/share?text=...). Some apps put the text in title or url.
  useEffect(() => {
    if (autoRan.current) return;
    const shared = ['title', 'text', 'url'].map((k) => params.get(k) ?? '').filter(Boolean).join('\n').trim();
    if (!shared) return;
    autoRan.current = true;
    setText(shared);
    const p = parseShare(shared);
    if (p) void post(p, shared);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  async function pasteFromClipboard() {
    setPasteNote('');
    try {
      const t = await navigator.clipboard.readText();
      if (!t.trim()) { setPasteNote('Your clipboard is empty. Tap Share in your game and choose Copy first.'); return; }
      setText(t);
      const p = parseShare(t);
      if (p) void post(p, t);
      else setPasteNote('That doesn’t look like a game result. Check it below or enter your score by hand.');
    } catch {
      setPasteNote('Your browser blocked clipboard access. Long-press the box below and choose Paste.');
    }
  }

  if (state.kind === 'posting') return <Shell><div className="center-block"><Spinner label="Posting" /><p className="muted">Posting your score…</p></div></Shell>;

  if (state.kind === 'done') {
    const s = state.score;
    return (
      <div className="celebrate-page">
        <Celebration score={s}>
          <div className="rank-list">
            {state.ranks.length === 0 && <p className="on-game-muted">You’re not in a league that plays this one yet.</p>}
            {state.ranks.map((r, i) => (
              <Link key={r.id} to={`/league/${r.id}`} className="rank-chip pop" style={{ animationDelay: `${1.2 + i * 0.15}s` }}>
                <strong>#{r.rank}</strong> of {r.of} in {r.name} →
              </Link>
            ))}
          </div>
          <div className="row gap center">
            <button className="btn on-game" onClick={() => { setText(''); setState({ kind: 'input' }); nav('/post', { replace: true }); }}>Post another</button>
            <Link className="btn on-game ghost" to="/">Home</Link>
          </div>
        </Celebration>
      </div>
    );
  }

  return (
    <Shell>
      <h1>Post a score</h1>

      {state.kind === 'duplicate' && (
        <div className="card warn stack">
          <p><strong>You already posted {getGame(state.parsed.gameId)?.name} today</strong> ({state.existing.display}).</p>
          <p className="muted">Replace it with {state.parsed.display}? Only do this if the first one was a mistake.</p>
          <div className="row gap">
            <button className="btn primary" onClick={() => post(state.parsed, state.raw, true)}>Replace it</button>
            <button className="btn ghost" onClick={() => setState({ kind: 'input' })}>Keep the original</button>
          </div>
        </div>
      )}
      {state.kind === 'error' && <p className="error" role="alert">Couldn’t post: {state.message}</p>}

      <section className="card stack">
        <button className="btn primary big" onClick={pasteFromClipboard}>📋 Paste from clipboard</button>
        {pasteNote && <p className="muted small">{pasteNote}</p>}
        <label htmlFor="share-text">Or paste the share text here</label>
        <textarea id="share-text" rows={6} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={'www.maptap.gg November 18\n93🏆 87🎉 71😁 99🏆 64🙂\nFinal score: 812'} />
        {text.trim() && (
          parsed ? (
            <div className="detected" style={gameVars(getGame(parsed.gameId))}>
              <span>Found <strong>{getGame(parsed.gameId)?.emoji} {getGame(parsed.gameId)?.name}</strong>: {parsed.display}</span>
              <button className="btn on-game" onClick={() => post(parsed, text)}>Post it</button>
            </div>
          ) : <p className="muted small">That doesn’t look like a supported game. Enter it by hand below.</p>
        )}
        {parsed && getGame(parsed.gameId)?.verified === false && (
          <p className="muted small">Heads up: {getGame(parsed.gameId)?.name}’s share format isn’t confirmed yet, so check the score before you post.</p>
        )}
      </section>

      <section className="card stack">
        <h2 className="section-title">Enter it by hand</h2>
        <form className="stack" onSubmit={(e) => {
          e.preventDefault();
          const value = manualFailed ? getGame(manualGame)?.manual.min ?? 0 : Number(manualValue);
          const r = manualScore(manualGame, value, manualFailed);
          if (r) void post(r, `manual:${manualGame}:${manualValue}${manualFailed ? ':failed' : ''}`);
        }}>
          <label htmlFor="mg">Game</label>
          <select id="mg" value={manualGame} onChange={(e) => { setManualGame(e.target.value); setManualFailed(false); }}>
            {GAMES.map((g) => <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>)}
          </select>
          <label htmlFor="mv">{getGame(manualGame)?.manual.label}</label>
          <input id="mv" type="number" inputMode="numeric" disabled={manualFailed}
            min={getGame(manualGame)?.manual.min} max={getGame(manualGame)?.manual.max}
            value={manualValue} onChange={(e) => setManualValue(e.target.value)} required={!manualFailed} />
          {getGame(manualGame)?.manual.failLabel && (
            <label className="check"><input type="checkbox" checked={manualFailed} onChange={(e) => setManualFailed(e.target.checked)} /> {getGame(manualGame)?.manual.failLabel}</label>
          )}
          <button className="btn">Post <GameChip id={manualGame} small /></button>
        </form>
      </section>
    </Shell>
  );
}
