import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getGame } from '@shared/games';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import {
  deleteLeague, deleteScore, getLeague, leagueMembers, removeMember, scoresFor, updateLeague,
} from '../lib/api';
import { PERIODS, addDays, periodRange, prettyDay, today, type Period } from '../lib/dates';
import { dayBoards, standings } from '../lib/standings';
import { firstScoreDay, pointsRace } from '../lib/series';
import { LineRace } from '../components/LineRace';
import { AWARDS, leagueAwards } from '../lib/awards';
import type { League, Member, Score } from '../lib/types';
import { Avatar, AwardBadge, CopyButton, Medal, Podium, Shell, Spinner, gameVars } from '../components/ui';
import { GamePicker, ThemePicker } from './NewLeague';

export default function LeaguePage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const { session } = useAuth();
  const nav = useNavigate();
  const me = session?.user.id ?? '';

  const [league, setLeague] = useState<League | null | undefined>(undefined);
  const [members, setMembers] = useState<Member[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [period, setPeriod] = useState<Period>('today');
  const [day, setDay] = useState(today());
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState('');
  const [live, setLive] = useState(false);

  const loadScores = useCallback(async (l: League, ms: Member[]) => {
    const since = addDays(today(), -400);
    setScores(await scoresFor(ms.map((m) => m.user_id), l.games, since));
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const l = await getLeague(id);
      setLeague(l);
      if (!l) return;
      const ms = await leagueMembers(id);
      setMembers(ms);
      await loadScores(l, ms);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [id, loadScores]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  // Live updates: refetch when anyone in the league posts. Subscribe once per member list.
  const memberKey = members.map((m) => m.user_id).sort().join(',');
  const leagueRef = useRef(league);
  leagueRef.current = league;
  useEffect(() => {
    if (!memberKey) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ch = supabase
      .channel(`league-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores', filter: `user_id=in.(${memberKey})` }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const l = leagueRef.current;
          if (l) void scoresFor(memberKey.split(','), l.games, addDays(today(), -400)).then(setScores);
        }, 400);
      })
      .subscribe((status) => setLive(status === 'SUBSCRIBED'));
    return () => { clearTimeout(timer); void supabase.removeChannel(ch); };
  }, [id, memberKey]);

  const profiles = useMemo(() => new Map(members.map((m) => [m.user_id, m.profile])), [members]);
  const memberIds = useMemo(() => members.map((m) => m.user_id), [members]);
  const games = league?.games ?? [];
  const [from, to] = periodRange(period, period === 'today' ? day : today());
  const table = useMemo(() => standings(scores, memberIds, games, from, to), [scores, memberIds, games, from, to]);
  const boards = useMemo(() => dayBoards(scores, games, day), [scores, games, day]);
  const awards = useMemo(() => leagueAwards(scores, memberIds, games, today()), [scores, memberIds, games]);
  // Week / Month / All time get a line graph that ends today; all time is bucketed by week.
  const race = useMemo(() => {
    if (period === 'today') return null;
    const end = today();
    const start = period === 'all' ? firstScoreDay(scores, memberIds, games) ?? end : from;
    return pointsRace(scores, memberIds, games, start, end, period === 'all' ? 'week' : 'day');
  }, [period, scores, memberIds, games, from]);
  // The draw-in animation plays the first time each tab is opened on this visit.
  const drawn = useRef(new Set<Period>());
  useEffect(() => { drawn.current.add(period); }, [period]);

  if (league === undefined) return <Shell><Spinner /></Shell>;
  if (league === null) {
    return <Shell><div className="empty"><p className="empty-emoji">🔒</p><p>This league doesn’t exist or you’re not in it.</p><Link to="/" className="btn">Home</Link></div></Shell>;
  }

  const theme = getGame(league.theme) ?? getGame(league.games[0]);
  const isOwner = league.created_by === me;
  const inviteUrl = `${window.location.origin}/join/${league.invite_code}`;
  const someonePlayed = table.some((s) => s.played > 0);
  const recentAwards = awards.filter((a) => a.day >= addDays(today(), -6)).slice(0, 12);
  const cabinet = members.map((m) => {
    const counts = new Map<string, number>();
    for (const a of awards) if (a.userId === m.user_id) counts.set(a.key, (counts.get(a.key) ?? 0) + 1);
    return { m, counts: [...counts.entries()].sort((a, b) => b[1] - a[1]) };
  }).filter((c) => c.counts.length);
  const waiting = members.filter((m) => !games.every((g) => boards[g]?.some((r) => r.score.user_id === m.user_id)));

  async function invite() {
    const data = { title: `Join ${league!.name} on Bragboard`, text: `Join my daily games league “${league!.name}” on Bragboard`, url: inviteUrl };
    if (navigator.share) { try { await navigator.share(data); } catch { /* cancelled */ } }
  }

  return (
    <Shell wide>
      <section className={`league-hero motif-${theme?.theme.motif ?? 'dots'}`} style={gameVars(theme)}>
        <div className="lh-top">
          <p className="eyebrow">{members.length} {members.length === 1 ? 'player' : 'players'} {live && <span className="live-dot" title="Live">● live</span>}</p>
          {isOwner && <button className="btn on-game ghost small" onClick={() => setEditing((v) => !v)}>{editing ? 'Close' : 'Edit'}</button>}
        </div>
        <h1>{league.name}</h1>
        <div className="lh-games">{games.map((g) => <span key={g} title={getGame(g)?.name}>{getGame(g)?.emoji}</span>)}</div>
        <div className="lh-invite">
          <span>Invite code <strong className="mono">{league.invite_code}</strong></span>
          <CopyButton text={inviteUrl} label="Copy invite link" className="btn on-game small" />
          {typeof navigator.share === 'function' && <button className="btn on-game ghost small" onClick={invite}>Share</button>}
        </div>
      </section>

      {params.get('new') && members.length === 1 && (
        <div className="card tip">
          <strong>Your league is ready.</strong> Send the invite link to your group chat. Anyone who opens it can sign in and join.
        </div>
      )}

      {editing && <LeagueSettings league={league} members={members} me={me} onSaved={loadAll} onDeleted={() => nav('/', { replace: true })} />}
      {err && <p className="error">{err}</p>}

      <div className="segmented" role="tablist" aria-label="Period">
        {PERIODS.map((p) => (
          <button key={p.id} role="tab" aria-selected={period === p.id} className={period === p.id ? 'on' : ''} onClick={() => setPeriod(p.id)}>{p.label}</button>
        ))}
      </div>

      {period === 'today' && (
        <div className="day-nav">
          <button className="btn ghost small" onClick={() => setDay(addDays(day, -1))} aria-label="Previous day">◀</button>
          <strong>{prettyDay(day)}</strong>
          <button className="btn ghost small" onClick={() => setDay(addDays(day, 1))} disabled={day >= today()} aria-label="Next day">▶</button>
        </div>
      )}

      {someonePlayed ? (
        <>
          {race && race.lines.length > 0 ? (
            <LineRace key={period} race={race} profiles={profiles} me={me} animate={!drawn.current.has(period)} />
          ) : (
            <Podium entries={table.filter((s) => s.played > 0).slice(0, 3).map((s) => ({
              profile: profiles.get(s.userId), value: `${s.total} pts`, sub: s.wins ? `${s.wins} ${s.wins === 1 ? 'win' : 'wins'}` : undefined,
            }))} />
          )}
          <div className="table-wrap">
            <table className="standings">
              <thead><tr><th>#</th><th>Player</th><th className="num">Pts</th><th className="num">Wins</th><th className="num">Played</th><th className="num">Avg</th></tr></thead>
              <tbody>
                {table.map((s) => (
                  <tr key={s.userId} className={s.userId === me ? 'me' : ''}>
                    <td>{s.played ? <Medal rank={s.rank} /> : '–'}</td>
                    <td><span className="who"><Avatar profile={profiles.get(s.userId)} size={28} />{profiles.get(s.userId)?.display_name}</span></td>
                    <td className="num strong">{s.total}</td>
                    <td className="num">{s.wins}</td>
                    <td className="num">{s.played}</td>
                    <td className="num">{s.played ? s.avg : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="empty">
          <p className="empty-emoji">🏁</p>
          <p>No scores {period === 'today' ? `for ${prettyDay(day).toLowerCase()}` : 'in this stretch'} yet. Be first, and grab Early Bird.</p>
          <Link to="/post" className="btn primary">Post a score</Link>
        </div>
      )}

      {period === 'today' && (
        <section>
          <h2 className="section-title">Game by game</h2>
          <div className="boards">
            {games.map((gid) => {
              const g = getGame(gid);
              if (!g) return null;
              const board = boards[gid] ?? [];
              return (
                <article key={gid} className={`board motif-${g.theme.motif}`} style={gameVars(g)}>
                  <header>
                    <a href={g.url} target="_blank" rel="noreferrer"><span aria-hidden>{g.emoji}</span> {g.name}</a>
                    <span className="board-count">{board.length}/{members.length}</span>
                  </header>
                  {board.length === 0 ? <p className="board-empty">Nobody yet.</p> : (
                    <ol>
                      {board.map(({ score, rank }, i) => (
                        <li key={score.id} className="slide-in" style={{ animationDelay: `${i * 0.06}s` }}>
                          <Medal rank={rank} />
                          <Avatar profile={profiles.get(score.user_id)} size={24} />
                          <span className="bn">{profiles.get(score.user_id)?.display_name}</span>
                          <span className={`bs ${score.failed ? 'failed' : ''}`}>{score.display}</span>
                          {score.user_id === me && day === today() && (
                            <button className="x" aria-label="Remove my score" title="Remove my score"
                              onClick={async () => { await deleteScore(score.id); setScores((s) => s.filter((x) => x.id !== score.id)); }}>×</button>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </article>
              );
            })}
          </div>
          {waiting.length > 0 && day === today() && (
            <p className="waiting">⏳ Still waiting on {waiting.map((m) => m.profile.display_name).join(', ')}</p>
          )}
        </section>
      )}

      <section>
        <h2 className="section-title">Awards this week</h2>
        {recentAwards.length === 0 ? <p className="muted">No awards yet. Crowns, streaks and sweeps show up here.</p> : (
          <div className="award-feed">
            {recentAwards.map((a) => (
              <div key={a.id} className="award-row">
                <Avatar profile={profiles.get(a.userId)} size={32} />
                <AwardBadge k={a.key} who={<>{profiles.get(a.userId)?.display_name}{a.gameId ? ` · ${getGame(a.gameId)?.name}` : ''} · {prettyDay(a.day)}</>} />
              </div>
            ))}
          </div>
        )}
      </section>

      {cabinet.length > 0 && (
        <section>
          <h2 className="section-title">Trophy cabinet</h2>
          <div className="cabinet">
            {cabinet.map(({ m, counts }) => (
              <div key={m.user_id} className="shelf">
                <span className="who"><Avatar profile={m.profile} size={28} /> {m.profile.display_name}</span>
                <div className="shelf-items">
                  {counts.map(([k, n]) => (
                    <span key={k} className={`trophy tone-${AWARDS[k].tone}`} title={`${AWARDS[k].title}: ${AWARDS[k].desc}`}>
                      {AWARDS[k].emoji}{n > 1 && <sub>×{n}</sub>}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!isOwner && (
        <button className="btn ghost danger" onClick={async () => {
          await removeMember(league.id, me);
          nav('/', { replace: true });
        }}>Leave league</button>
      )}
    </Shell>
  );
}

function LeagueSettings({ league, members, me, onSaved, onDeleted }: {
  league: League; members: Member[]; me: string; onSaved: () => void; onDeleted: () => void;
}) {
  const [name, setName] = useState(league.name);
  const [games, setGames] = useState(league.games);
  const [theme, setTheme] = useState(league.theme);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <section className="card stack">
      <h2 className="section-title">League settings</h2>
      <label htmlFor="ename">Name</label>
      <input id="ename" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
      <h3 className="section-title">Games</h3>
      <GamePicker value={games} onChange={setGames} />
      <h3 className="section-title">Theme</h3>
      <ThemePicker value={theme} onChange={setTheme} games={games} />
      <button className="btn primary" disabled={busy || !name.trim() || !games.length} onClick={async () => {
        setBusy(true);
        await updateLeague(league.id, { name: name.trim(), games, theme: games.includes(theme) ? theme : games[0] });
        setBusy(false);
        onSaved();
      }}>Save changes</button>

      <h3 className="section-title">Players</h3>
      <ul className="member-list">
        {members.map((m) => (
          <li key={m.user_id}>
            <span className="who"><Avatar profile={m.profile} size={28} /> {m.profile.display_name}{m.role === 'owner' && <em> · owner</em>}</span>
            {m.user_id !== me && (
              <button className="btn ghost small danger" onClick={async () => { await removeMember(league.id, m.user_id); onSaved(); }}>Remove</button>
            )}
          </li>
        ))}
      </ul>

      {!confirmDelete ? (
        <button className="btn ghost danger" onClick={() => setConfirmDelete(true)}>Delete league…</button>
      ) : (
        <div className="card warn stack">
          <p>Delete <strong>{league.name}</strong> for everyone? Scores stay on each player’s account, but the league and its history view are gone.</p>
          <div className="row gap">
            <button className="btn danger" onClick={async () => { await deleteLeague(league.id); onDeleted(); }}>Delete it</button>
            <button className="btn ghost" onClick={() => setConfirmDelete(false)}>Keep it</button>
          </div>
        </div>
      )}
    </section>
  );
}
