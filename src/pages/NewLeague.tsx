import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { GAMES, getGame } from '@shared/games';
import { createLeague } from '../lib/api';
import { Shell, gameVars } from '../components/ui';

export function GamePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="game-picker">
      {GAMES.map((g) => {
        const on = value.includes(g.id);
        return (
          <button type="button" key={g.id} className={`gp-tile motif-${g.theme.motif} ${on ? 'on' : ''}`} style={gameVars(g)}
            aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== g.id) : [...value, g.id])}>
            <span className="gp-emoji" aria-hidden>{g.emoji}</span>
            <span className="gp-name">{g.name}</span>
            <span className="gp-blurb">{g.blurb}</span>
            {!g.verified && <span className="gp-flag">format pending</span>}
            <span className="gp-check" aria-hidden>{on ? '✓' : '+'}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ThemePicker({ value, onChange, games }: { value: string; onChange: (v: string) => void; games: string[] }) {
  const options = games.length ? games : GAMES.map((g) => g.id);
  return (
    <div className="theme-picker">
      {options.map((id) => {
        const g = getGame(id)!;
        return (
          <button type="button" key={id} className={`theme-swatch motif-${g.theme.motif} ${value === id ? 'on' : ''}`} style={gameVars(g)}
            aria-pressed={value === id} onClick={() => onChange(id)}>
            {g.emoji}<span className="sr">{g.name} theme</span>
          </button>
        );
      })}
    </div>
  );
}

export default function NewLeague() {
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [games, setGames] = useState<string[]>(['maptap', 'krillion', 'yeastimate', 'plane']);
  const [theme, setTheme] = useState('maptap');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const l = await createLeague(name.trim(), games, games.includes(theme) ? theme : games[0]);
      nav(`/league/${l.id}?new=1`, { replace: true });
    } catch (e2) {
      setErr((e2 as Error).message);
      setBusy(false);
    }
  }

  return (
    <Shell>
      <form className="stack" onSubmit={submit}>
        <h1>Start a league</h1>
        <label htmlFor="ln">League name</label>
        <input id="ln" required maxLength={40} placeholder="The Lunch Table" value={name} onChange={(e) => setName(e.target.value)} />

        <h2 className="section-title">Games on the card <span className="muted">({games.length})</span></h2>
        <GamePicker value={games} onChange={setGames} />

        <h2 className="section-title">Theme</h2>
        <ThemePicker value={theme} onChange={setTheme} games={games} />

        <button className="btn primary big" disabled={busy || !name.trim() || games.length === 0}>{busy ? 'Creating…' : 'Create league'}</button>
        {err && <p className="error">{err}</p>}
      </form>
    </Shell>
  );
}
