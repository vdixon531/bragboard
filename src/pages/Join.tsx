import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getGame } from '@shared/games';
import { joinLeague, peekLeague } from '../lib/api';
import { Shell, Spinner, GameChip, gameVars } from '../components/ui';

export default function Join() {
  const { code = '' } = useParams();
  const nav = useNavigate();
  const [info, setInfo] = useState<Awaited<ReturnType<typeof peekLeague>> | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    peekLeague(code).then(setInfo).catch((e) => setErr(e.message));
  }, [code]);

  async function join() {
    setBusy(true);
    try {
      const l = await joinLeague(code);
      nav(`/league/${l.id}`, { replace: true });
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  const g = info ? getGame(info.theme) : undefined;
  return (
    <Shell>
      {info === undefined && !err && <Spinner />}
      {info === null && <div className="empty"><p className="empty-emoji">🤔</p><p>No league uses the code <strong>{code}</strong>. Check it with whoever sent it.</p></div>}
      {info && (
        <section className={`invite motif-${g?.theme.motif ?? 'dots'}`} style={gameVars(g)}>
          <p className="eyebrow">You’re invited to</p>
          <h1>{info.name}</h1>
          <p>{info.members} {info.members === 1 ? 'player' : 'players'} · {info.games.length} games</p>
          <div className="chip-row">{info.games.map((id) => <GameChip key={id} id={id} small />)}</div>
          <button className="btn on-game big" onClick={join} disabled={busy}>{busy ? 'Joining…' : 'Join league'}</button>
        </section>
      )}
      {err && <p className="error">{err}</p>}
    </Shell>
  );
}
