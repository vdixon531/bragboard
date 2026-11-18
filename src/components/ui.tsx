import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { getGame, type GameDef } from '@shared/games';
import type { Profile } from '../lib/types';
import { AWARDS } from '../lib/awards';

export const gameVars = (g?: GameDef): CSSProperties =>
  (g ? { '--g-bg': g.theme.bg, '--g-fg': g.theme.fg, '--g-accent': g.theme.accent } : {}) as CSSProperties;

export function Avatar({ profile, size = 36 }: { profile?: Profile | null; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.55, background: profile?.color ?? 'var(--line)' }} aria-hidden>
      {profile?.avatar ?? '🙂'}
    </span>
  );
}

export function GameChip({ id, small }: { id: string; small?: boolean }) {
  const g = getGame(id);
  if (!g) return null;
  return (
    <span className={`game-chip ${small ? 'small' : ''}`} style={gameVars(g)}>
      <span aria-hidden>{g.emoji}</span> {g.name}
    </span>
  );
}

export function Medal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="medal gold" aria-label="1st">1</span>;
  if (rank === 2) return <span className="medal silver" aria-label="2nd">2</span>;
  if (rank === 3) return <span className="medal bronze" aria-label="3rd">3</span>;
  return <span className="medal plain">{rank}</span>;
}

export function AwardBadge({ k, who, small }: { k: string; who?: ReactNode; small?: boolean }) {
  const a = AWARDS[k];
  if (!a) return null;
  return (
    <div className={`award tone-${a.tone} ${small ? 'small' : ''}`}>
      <span className="award-emoji" aria-hidden>{a.emoji}</span>
      <div className="award-text">
        <strong>{a.title}</strong>
        <span>{who ? <>{who} · </> : null}{a.desc}</span>
      </div>
    </div>
  );
}

export function useCountUp(target: number, ms = 1100, start = true) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!start) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(target); return; }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, start]);
  return v;
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <div className="spinner" role="status"><span className="dot" /><span className="dot" /><span className="dot" /><span className="sr">{label}</span></div>;
}

export function Shell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="wordmark" aria-label="Bragboard home">
          <img src="/icon.svg" alt="" width={28} height={28} /> Bragboard
        </Link>
      </header>
      <main className={`page ${wide ? 'wide' : ''}`}>{children}</main>
      <nav className="tabbar" aria-label="Main">
        <NavLink to="/" end><span aria-hidden>🏠</span>Home</NavLink>
        <NavLink to="/post" className="tab-post"><span aria-hidden>＋</span>Post</NavLink>
        <NavLink to="/me"><span aria-hidden>🙋</span>Me</NavLink>
      </nav>
    </div>
  );
}

/** Copy with fallback to selecting the text (some webviews refuse clipboard writes). */
export function CopyButton({ text, label = 'Copy', className = 'btn ghost small' }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button
      ref={ref}
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        }
      }}
    >
      {done ? 'Copied ✓' : label}
    </button>
  );
}

export interface PodiumEntry { profile?: Profile; value: string; sub?: string }
export function Podium({ entries }: { entries: PodiumEntry[] }) {
  // Visual order: 2nd, 1st, 3rd
  const slots = [entries[1], entries[0], entries[2]];
  const places = [2, 1, 3];
  return (
    <div className="podium">
      {slots.map((e, i) => (
        <div key={places[i]} className={`podium-slot p${places[i]} ${e ? '' : 'empty'}`} style={{ animationDelay: `${[0.15, 0, 0.3][i]}s` }}>
          {e ? (
            <>
              {places[i] === 1 && <span className="crown" aria-hidden>👑</span>}
              <Avatar profile={e.profile} size={places[i] === 1 ? 56 : 44} />
              <span className="podium-name">{e.profile?.display_name ?? 'Someone'}</span>
              <span className="podium-value">{e.value}</span>
              {e.sub && <span className="podium-sub">{e.sub}</span>}
            </>
          ) : <span className="podium-name muted">—</span>}
          <div className="podium-block"><span>{places[i]}</span></div>
        </div>
      ))}
    </div>
  );
}
