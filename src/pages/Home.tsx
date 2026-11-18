import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getGame } from '@shared/games';
import { useAuth } from '../lib/auth';
import { myLeagues, myScoresOn } from '../lib/api';
import { today } from '../lib/dates';
import type { League, Score } from '../lib/types';
import { Avatar, Shell, Spinner, gameVars } from '../components/ui';

export default function Home() {
  const { session, profile } = useAuth();
  const nav = useNavigate();
  const [leagues, setLeagues] = useState<League[] | null>(null);
  const [mine, setMine] = useState<Score[]>([]);
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!session) return;
    const uid = session.user.id;
    Promise.all([myLeagues(uid), myScoresOn(uid, today())])
      .then(([l, s]) => { setLeagues(l); setMine(s); })
      .catch((e) => setErr(e.message));
  }, [session]);

  const gameIds = [...new Set((leagues ?? []).flatMap((l) => l.games))];
  const posted = new Map(mine.map((s) => [s.game_id, s]));
  const doneCount = gameIds.filter((g) => posted.has(g)).length;
  const hour = new Date().getHours();
  const hello = hour < 5 ? 'Up late' : hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';

  return (
    <Shell>
      <section className="hello">
        <Avatar profile={profile} size={52} />
        <div>
          <h1>{hello}, {profile?.display_name}</h1>
          <p className="muted">
            {gameIds.length === 0 ? 'Start a league or join one to get going.'
              : doneCount === gameIds.length ? 'Full card posted today. Go gloat.'
              : `${doneCount} of ${gameIds.length} games posted today.`}
          </p>
        </div>
      </section>

      <Link to="/post" className="post-cta">
        <span className="post-cta-icon" aria-hidden>📋</span>
        <span>
          <strong>Post a score</strong>
          <small>Paste a share result, or use the share button in your game</small>
        </span>
        <span aria-hidden className="post-cta-arrow">→</span>
      </Link>

      {err && <p className="error">{err}</p>}
      {!leagues && !err && <Spinner />}

      {gameIds.length > 0 && (
        <section>
          <h2 className="section-title">Today’s card</h2>
          <div className="today-grid">
            {gameIds.map((id) => {
              const g = getGame(id);
              if (!g) return null;
              const s = posted.get(id);
              return s ? (
                <div key={id} className={`today-tile done motif-${g.theme.motif}`} style={gameVars(g)}>
                  <span className="tt-emoji" aria-hidden>{g.emoji}</span>
                  <span className="tt-name">{g.name}</span>
                  <span className="tt-score">{s.display}</span>
                  <span className="tt-check" aria-label="posted">✓</span>
                </div>
              ) : (
                <a key={id} href={g.url} target="_blank" rel="noreferrer" className="today-tile todo" style={gameVars(g)}>
                  <span className="tt-emoji" aria-hidden>{g.emoji}</span>
                  <span className="tt-name">{g.name}</span>
                  <span className="tt-score">Play ↗</span>
                </a>
              );
            })}
          </div>
        </section>
      )}

      {leagues && (
        <section>
          <h2 className="section-title">Your leagues</h2>
          {leagues.length === 0 && (
            <div className="empty">
              <p className="empty-emoji" aria-hidden>🏁</p>
              <p><strong>No leagues yet.</strong> Start one for your group chat, or join one with the code a friend sent you.</p>
            </div>
          )}
          <div className="league-list">
            {leagues.map((l) => {
              const g = getGame(l.theme) ?? getGame(l.games[0]);
              return (
                <Link key={l.id} to={`/league/${l.id}`} className={`league-card motif-${g?.theme.motif ?? 'dots'}`} style={gameVars(g)}>
                  <span className="lc-name">{l.name}</span>
                  <span className="lc-games">{l.games.map((id) => getGame(id)?.emoji).join(' ')}</span>
                </Link>
              );
            })}
          </div>
          <div className="row gap">
            <Link to="/new" className="btn primary">Start a league</Link>
            <form className="join-inline" onSubmit={(e) => { e.preventDefault(); if (code.trim()) nav(`/join/${code.trim().toUpperCase()}`); }}>
              <label htmlFor="code" className="sr">Invite code</label>
              <input id="code" placeholder="Invite code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
              <button className="btn" disabled={code.trim().length < 4}>Join</button>
            </form>
          </div>
        </section>
      )}
    </Shell>
  );
}
