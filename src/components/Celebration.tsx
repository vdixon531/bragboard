import { useEffect, type ReactNode } from 'react';
import { getGame, type GameDef } from '@shared/games';
import type { Score } from '../lib/types';
import { burst } from '../lib/confetti';
import { gameVars, useCountUp, AwardBadge } from './ui';

const CONFETTI_EMOJI: Record<string, string[]> = {
  maptap: ['📍', '🌍'], krillion: ['🦐', '🫧'], yeastimate: ['🍞', '🥐'], plane: ['✈️', '☁️'],
  wordle: ['🟩', '🟨'], connections: ['🟪', '🟦', '🟩', '🟨'], strands: ['💡', '🔵'], mini: ['⏱️'],
  worldle: ['🗺️'], globle: ['🌍', '🔥'], timeguessr: ['⏳', '📷'], framed: ['🎬', '🍿'],
};

/** A little scene per game motif, played behind the score. */
function Scene({ g, s }: { g: GameDef; s: Score }) {
  switch (g.theme.motif) {
    case 'topo': {
      const rounds = (s.meta?.rounds as number[] | undefined) ?? [];
      // Keep pins in the top and bottom bands so they never sit on the score.
      const spots = [[14, 10], [58, 16], [82, 8], [22, 82], [70, 86]];
      return (
        <div className="scene scene-topo" aria-hidden>
          {spots.map(([x, y], i) => (
            <span key={i} className="pin" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${0.15 + i * 0.18}s` }}>
              📍{rounds[i] != null && <em>{rounds[i]}</em>}
            </span>
          ))}
        </div>
      );
    }
    case 'bubbles': {
      const depth = Number(s.meta?.depth ?? s.score * 10);
      return (
        <div className="scene scene-bubbles" aria-hidden>
          {Array.from({ length: 16 }, (_, i) => (
            <span key={i} className="bubble" style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 7) * 0.25}s`, width: 8 + (i % 4) * 6, height: 8 + (i % 4) * 6 }} />
          ))}
          <DepthGauge depth={depth} />
        </div>
      );
    }
    case 'crumbs':
      return <div className="scene scene-crumbs" aria-hidden><span className="loaf">🍞</span><span className="steam">〰️</span></div>;
    case 'flight':
      return (
        <div className="scene scene-flight" aria-hidden>
          <span className="trail" />
          <span className="jet">✈️</span>
          <span className="cloud c1">☁️</span><span className="cloud c2">☁️</span>
        </div>
      );
    case 'tiles': {
      const g6 = s.failed ? 6 : Math.min(6, Math.max(1, s.score));
      return (
        <div className="scene scene-tiles" aria-hidden>
          {Array.from({ length: g6 }, (_, r) => (
            <div key={r} className="tile-row">
              {Array.from({ length: 5 }, (_, c) => (
                <span key={c} className={`tile ${r === g6 - 1 && !s.failed ? 'hit' : (r + c) % 3 === 0 ? 'near' : ''}`} style={{ animationDelay: `${r * 0.12 + c * 0.06}s` }} />
              ))}
            </div>
          ))}
        </div>
      );
    }
    case 'grid4':
      return (
        <div className="scene scene-grid4" aria-hidden>
          {['#F9DF6D', '#A0C35A', '#B0C4EF', '#BA81C5'].map((c, i) => (
            <span key={c} style={{ background: c, animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      );
    case 'threads':
      return (
        <svg className="scene scene-threads" viewBox="0 0 200 120" aria-hidden>
          <path d="M10 100 C 40 20, 70 20, 100 60 S 160 100, 190 20" />
        </svg>
      );
    case 'clock':
      return <div className="scene scene-clock" aria-hidden><span className="face" /><span className="hand" /></div>;
    case 'globe':
      return <div className="scene scene-globe" aria-hidden><span className="planet">{g.id === 'globle' ? '🌍' : '🗺️'}</span><span className="orbit" /></div>;
    case 'film':
      return <div className="scene scene-film" aria-hidden><div className="strip">{'🎞️🎬🍿🎞️🎬🍿🎞️🎬🍿'}</div></div>;
    case 'hourglass':
      return <div className="scene scene-hourglass" aria-hidden><span>⏳</span></div>;
    default:
      return null;
  }
}

function DepthGauge({ depth }: { depth: number }) {
  const v = useCountUp(depth, 1600);
  return <div className="depth">−{Math.round(v).toLocaleString()} m</div>;
}

function BigScore({ s }: { s: Score }) {
  // Count up when the display is a plain number; otherwise pop the text in.
  const plain = /^[\d,]+$/.test(s.display) || /^[\d,]+ pts$/.test(s.display);
  const v = useCountUp(s.score, 1200, plain);
  const text = plain ? s.display.replace(/[\d,]+/, Math.round(v).toLocaleString('en-US')) : s.display;
  return <div className="big-score">{text}</div>;
}

export function Celebration({ score, children, onClose }: { score: Score; children?: ReactNode; onClose?: () => void }) {
  const g = getGame(score.game_id);
  useEffect(() => {
    if (!g) return;
    const t = setTimeout(() => burst({ colors: [g.theme.accent, g.theme.fg, '#FF6B2C', '#FFD14A'], emoji: CONFETTI_EMOJI[g.id] }), 450);
    return () => clearTimeout(t);
  }, [g]);
  if (!g) return null;
  const keys = (score as Score & { awardKeys?: string[] }).awardKeys ?? [];
  return (
    <section className={`celebrate motif-${g.theme.motif}`} style={gameVars(g)}>
      <Scene g={g} s={score} />
      <div className="celebrate-body">
        <div className="celebrate-game"><span aria-hidden>{g.emoji}</span> {g.name}{score.puzzle ? <small> #{score.puzzle}</small> : null}</div>
        <BigScore s={score} />
        <div className="celebrate-points">{Math.round(score.points)} league points</div>
        {keys.length > 0 && (
          <div className="celebrate-awards">
            {keys.map((k, i) => <div key={k} className="pop" style={{ animationDelay: `${0.9 + i * 0.2}s` }}><AwardBadge k={k} /></div>)}
          </div>
        )}
        {children}
        {onClose && <button className="btn on-game" onClick={onClose}>Done</button>}
      </div>
    </section>
  );
}
