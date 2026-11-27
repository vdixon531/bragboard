import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { Profile } from '../lib/types';
import type { RankRace as Race } from '../lib/series';
import { fromDay } from '../lib/dates';

const ROW = 36;           // vertical gap between places
const M = { top: 20, right: 40, bottom: 30, left: 40 };
const AV = 24;            // avatar diameter at the line tip
const DRAW_MS = 1800;

const ordinal = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${s}`;
};
const ease = (t: number) => t * t * (3 - 2 * t);

/**
 * Bump chart: each player's place in the running standings at the end of every day, 1st at the top.
 * The axis runs from the first day shown to today. Lines cross where someone overtakes.
 * `animate` draws the lines in left-to-right on mount only, with avatars riding the tips.
 */
export function RankRace({ race, profiles, animate, me }: {
  race: Race; profiles: Map<string, Profile>; animate: boolean; me: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  const [progress, setProgress] = useState(() => (animate && !reducedMotion() ? 0 : 1));
  const [hover, setHover] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Runs once on mount: later data changes (live updates) never replay the draw.
  useEffect(() => {
    if (progress >= 1) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / DRAW_MS);
      setProgress(p < 1 ? p : 1);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const n = race.xs.length;
  const last = n - 1;
  const places = Math.max(1, race.places);
  const plotW = Math.max(10, w - M.left - M.right);
  const plotH = Math.max(0, (places - 1) * ROW);
  const H = M.top + plotH + M.bottom;
  const x = (i: number) => M.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (rank: number) => M.top + (rank - 1) * ROW;
  const short = n > 7;

  const ticksX = useMemo(() => {
    if (!short) return race.xs.map((_, i) => i);
    const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / 34))));
    const out: number[] = [];
    for (let i = 0; i < n; i += every) out.push(i);
    if (out[out.length - 1] !== n - 1) {
      if ((n - 1 - out[out.length - 1]) * (plotW / (n - 1)) < 26) out.pop();
      out.push(n - 1);
    }
    return out;
  }, [n, plotW, short, race.xs]);

  // The draw-in sweeps from the first day to today.
  const fi = progress * Math.max(0, last);
  const revealX = last <= 0 ? w : x(fi) + 1;

  const tip = (ranks: (number | null)[]) => {
    const i = Math.floor(fi);
    const r0 = ranks[i];
    if (r0 == null) return null;
    const r1 = ranks[i + 1];
    if (i + 1 > last || r1 == null) return { x: x(i), y: y(r0) };
    const t = fi - i;
    return { x: x(fi), y: y(r0) + (y(r1) - y(r0)) * ease(t) };
  };

  const pathFor = (ranks: (number | null)[]) => {
    let d = '';
    for (let i = 0; i <= last; i++) {
      const r = ranks[i];
      if (r == null) continue;
      const prev = i > 0 ? ranks[i - 1] : null;
      if (prev == null) { d += `M${x(i).toFixed(1)},${y(r).toFixed(1)}`; continue; }
      const mx = ((x(i - 1) + x(i)) / 2).toFixed(1);
      d += `C${mx},${y(prev).toFixed(1)} ${mx},${y(r).toFixed(1)} ${x(i).toFixed(1)},${y(r).toFixed(1)}`;
    }
    return d;
  };

  // Today's leader is drawn last so their line sits on top; "me" goes above everyone else.
  const order = race.lines.map((_, i) => i).sort((a, b) => {
    const la = race.lines[a], lb = race.lines[b];
    if (la.userId === me) return 1;
    if (lb.userId === me) return -1;
    return (lb.ranks[last] ?? 99) - (la.ranks[last] ?? 99);
  });

  function onMove(e: PointerEvent<SVGRectElement>) {
    const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = n <= 1 ? 0 : Math.round(((px - M.left) / plotW) * (n - 1));
    setHover(Math.max(0, Math.min(last, i)));
  }

  const leader = race.lines.find((l) => l.ranks[last] === 1);
  const summary = leader
    ? `Place in the standings each day. ${profiles.get(leader.userId)?.display_name ?? 'Someone'} is 1st today.`
    : 'Place in the standings each day.';

  const hoverRows = hover === null ? [] : race.lines
    .filter((l) => l.ranks[hover] != null)
    .sort((a, b) => a.ranks[hover]! - b.ranks[hover]!);
  const tipLeft = hover === null ? 0 : x(hover);
  const flip = tipLeft > w / 2;

  return (
    <figure className="race">
      <div className="race-plot" ref={wrap}>
        <svg width={w} height={H} role="img" aria-label={summary}>
          <defs>
            <clipPath id="rank-reveal"><rect x={0} y={0} width={revealX} height={H} /></clipPath>
          </defs>

          <g className="race-grid">
            {Array.from({ length: places }, (_, k) => k + 1).map((r) => (
              <g key={r}>
                <line x1={M.left} x2={M.left + plotW} y1={y(r)} y2={y(r)} />
                <text x={M.left - 10} y={y(r)} dy="0.32em" textAnchor="end" className={r === 1 ? 'first' : ''}>{ordinal(r)}</text>
              </g>
            ))}
            {ticksX.map((i) => (
              <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className={i === last ? 'now' : ''}>
                {short ? fromDay(race.xs[i]).getDate() : fromDay(race.xs[i]).toLocaleDateString(undefined, { weekday: 'short' })}
              </text>
            ))}
          </g>

          <g clipPath="url(#rank-reveal)">
            {order.map((li) => {
              const l = race.lines[li];
              const color = profiles.get(l.userId)?.color ?? 'var(--muted)';
              const d = pathFor(l.ranks);
              return (
                <g key={l.userId} className={l.userId === me ? 'race-line me' : 'race-line'} style={{ '--c': color } as CSSProperties}>
                  <path d={d} className="halo" />
                  <path d={d} className="stroke" />
                  {!short && l.ranks.map((r, i) => r != null && (
                    <circle key={i} cx={x(i)} cy={y(r)} r={3.5} className="rank-dot" />
                  ))}
                </g>
              );
            })}
          </g>

          {hover !== null && (
            <g className="race-hover">
              <line x1={x(hover)} x2={x(hover)} y1={M.top - 10} y2={M.top + plotH + 10} />
            </g>
          )}

          {order.map((li) => {
            const l = race.lines[li];
            const t = tip(l.ranks);
            if (!t) return null;
            const p = profiles.get(l.userId);
            return (
              <g key={l.userId} className="race-tip" transform={`translate(${t.x},${t.y})`}>
                <circle cx={0} cy={0} r={AV / 2} fill={p?.color ?? 'var(--line)'} />
                <text x={0} y={0} dy="0.35em" textAnchor="middle" fontSize={AV * 0.6}>{p?.avatar ?? '🙂'}</text>
              </g>
            );
          })}

          <rect
            x={M.left - 12} y={0} width={plotW + 24} height={H} fill="transparent" className="race-hit"
            onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHover(null); }}
          />
        </svg>

        {hover !== null && (
          <div className="race-tooltip" role="status" style={flip ? { right: w - tipLeft + 12 } : { left: tipLeft + 12 }}>
            <strong>{fromDay(race.xs[hover]).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</strong>
            {hoverRows.map((l) => {
              const r = l.ranks[hover]!;
              const prev = hover > 0 ? l.ranks[hover - 1] : null;
              const move = prev == null ? '' : prev > r ? '▲' : prev < r ? '▼' : '';
              return (
                <span key={l.userId} className="rt-row rank">
                  <span className="rt-place">{ordinal(r)}</span>
                  <span className="rt-swatch" style={{ background: profiles.get(l.userId)?.color }} aria-hidden>{profiles.get(l.userId)?.avatar}</span>
                  <span className="rt-name">{profiles.get(l.userId)?.display_name}{move && <span className={move === '▲' ? 'rt-up' : 'rt-down'}> {move}</span>}</span>
                  <span className="rt-val">{l.totals[hover]}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      <figcaption className="race-legend">
        {[...race.lines].sort((a, b) => (a.ranks[last] ?? 99) - (b.ranks[last] ?? 99)).map((l) => {
          const p = profiles.get(l.userId);
          return (
            <span key={l.userId} className="rl-item">
              <span className="rl-key" style={{ '--c': p?.color } as CSSProperties} aria-hidden />
              {p?.avatar} {p?.display_name}
            </span>
          );
        })}
      </figcaption>
    </figure>
  );
}

function reducedMotion() {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}
