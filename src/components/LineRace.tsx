import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { Profile } from '../lib/types';
import type { Race } from '../lib/series';
import { fromDay } from '../lib/dates';

const H = 260;
const M = { top: 18, right: 40, bottom: 28, left: 40 };
const AV = 22;            // avatar diameter at the line tip
const DRAW_MS = 1500;

const niceMax = (v: number) => {
  if (v <= 0) return 10;
  const mag = 10 ** Math.floor(Math.log10(v));
  const n = v / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
};

function xLabel(day: string, race: Race, short: boolean) {
  const d = fromDay(day);
  if (race.bucket === 'day' && race.xs.length <= 7) return d.toLocaleDateString(undefined, { weekday: 'short' });
  const spansYears = fromDay(race.xs[0]).getFullYear() !== fromDay(race.xs[race.xs.length - 1]).getFullYear();
  if (spansYears && short) return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Push overlapping tip avatars apart vertically, keeping them inside [lo, hi]. */
function spread(ys: number[], gap: number, lo: number, hi: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < order.length; k++) order[k].y = Math.max(order[k].y, order[k - 1].y + gap);
  const over = order.length ? order[order.length - 1].y - hi : 0;
  if (over > 0) for (const o of order) o.y -= over;
  for (let k = order.length - 2; k >= 0; k--) order[k].y = Math.min(order[k].y, order[k + 1].y - gap);
  for (const o of order) o.y = Math.max(lo, o.y);
  const out = new Array(ys.length);
  for (const o of order) out[o.i] = o.y;
  return out;
}

/**
 * Running points total per player, one line each, coloured by the player's colour with their avatar riding the tip.
 * `animate` draws the lines in left-to-right on mount only; data updates afterwards just redraw.
 */
export function LineRace({ race, profiles, animate, me }: {
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
      setProgress(1 - Math.pow(1 - p, 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const n = race.xs.length;
  const plotW = Math.max(10, w - M.left - M.right);
  const plotH = H - M.top - M.bottom;
  const top = niceMax(Math.max(0, ...race.lines.flatMap((l) => l.values)));
  const x = (i: number) => M.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => M.top + plotH - (v / top) * plotH;

  const ticksY = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(top * f));
  const ticksX = useMemo(() => {
    if (n <= 1) return [0];
    const room = Math.max(2, Math.floor(plotW / 64));
    const every = Math.max(1, Math.ceil((n - 1) / (room - 1)));
    const out: number[] = [];
    for (let i = 0; i < n; i += every) out.push(i);
    if (out[out.length - 1] !== n - 1) {
      if ((n - 1 - out[out.length - 1]) * (plotW / (n - 1)) < 80) out.pop();
      out.push(n - 1);
    }
    return out;
  }, [n, plotW]);

  // Where each line's tip is at the current point of the draw-in.
  const fi = progress * Math.max(0, n - 1);
  const valueAt = (vals: number[], f: number) => {
    const i = Math.floor(f);
    const t = f - i;
    return i + 1 < vals.length ? vals[i] + (vals[i + 1] - vals[i]) * t : vals[Math.min(i, vals.length - 1)];
  };
  const tipX = n <= 1 ? x(0) : M.left + progress * plotW;
  const tipYs = race.lines.map((l) => y(valueAt(l.values, fi)));
  const avatarYs = spread(tipYs, AV + 2, M.top, M.top + plotH);
  // Draw the player in the lead last so their line sits on top.
  const order = race.lines.map((_, i) => i).sort((a, b) => race.lines[a].values[n - 1] - race.lines[b].values[n - 1]);

  function onMove(e: PointerEvent<SVGRectElement>) {
    const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = e.clientX - r.left;
    setHover(n <= 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round(((px - M.left) / plotW) * (n - 1)))));
  }

  const leader = order.length ? race.lines[order[order.length - 1]] : null;
  const summary = leader
    ? `Running points total. ${profiles.get(leader.userId)?.display_name ?? 'Leader'} leads with ${leader.values[n - 1]} points.`
    : 'Running points total.';

  const hoverRows = hover === null ? [] : race.lines
    .map((l) => ({ l, v: l.values[hover] }))
    .sort((a, b) => b.v - a.v);
  const tipLeft = hover === null ? 0 : x(hover);
  const flip = tipLeft > w / 2;

  return (
    <figure className="race">
      <div className="race-plot" ref={wrap}>
        <svg width={w} height={H} role="img" aria-label={summary}>
          <defs>
            <clipPath id="race-reveal">
              <rect x={0} y={0} width={n <= 1 ? w : M.left + progress * plotW + 1} height={H} />
            </clipPath>
          </defs>

          <g className="race-grid">
            {ticksY.map((t) => (
              <g key={t}>
                <line x1={M.left} x2={M.left + plotW} y1={y(t)} y2={y(t)} className={t === 0 ? 'base' : ''} />
                <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end">{t}</text>
              </g>
            ))}
            {ticksX.map((i) => (
              <text key={i} x={x(i)} y={H - 8} textAnchor={n <= 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
                {xLabel(race.xs[i], race, true)}
              </text>
            ))}
          </g>

          <g clipPath="url(#race-reveal)">
            {order.map((li) => {
              const l = race.lines[li];
              const color = profiles.get(l.userId)?.color ?? 'var(--muted)';
              const d = l.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
              return (
                <g key={l.userId} className={l.userId === me ? 'race-line me' : 'race-line'}>
                  <path d={d} className="halo" />
                  <path d={d} style={{ '--c': color } as CSSProperties} className="stroke" />
                  {n <= 1 && <circle cx={x(0)} cy={y(l.values[0])} r={4} fill={color} />}
                </g>
              );
            })}
          </g>

          {hover !== null && (
            <g className="race-hover">
              <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + plotH} />
              {race.lines.map((l) => (
                <circle key={l.userId} cx={x(hover)} cy={y(l.values[hover])} r={4.5} fill={profiles.get(l.userId)?.color ?? 'var(--muted)'} />
              ))}
            </g>
          )}

          {order.map((li) => {
            const l = race.lines[li];
            const p = profiles.get(l.userId);
            return (
              <g key={l.userId} className="race-tip" transform={`translate(${tipX + 4},${avatarYs[li]})`}>
                {Math.abs(avatarYs[li] - tipYs[li]) > 3 && (
                  <line x1={-4} y1={tipYs[li] - avatarYs[li]} x2={AV / 2 - 4} y2={0} stroke={p?.color ?? 'var(--muted)'} />
                )}
                <circle cx={AV / 2} cy={0} r={AV / 2} fill={p?.color ?? 'var(--line)'} />
                <text x={AV / 2} y={0} dy="0.35em" textAnchor="middle" fontSize={AV * 0.6}>{p?.avatar ?? '🙂'}</text>
              </g>
            );
          })}

          <rect
            x={M.left - 12} y={0} width={plotW + 24} height={H} fill="transparent" className="race-hit"
            onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHover(null); }}
          />
        </svg>

        {hover !== null && (
          <div className="race-tooltip" role="status"
            style={flip ? { right: w - tipLeft + 12 } : { left: tipLeft + 12 }}>
            <strong>{race.bucket === 'week' ? `Week of ${xLabel(race.xs[hover], race, false)}` : fromDay(race.xs[hover]).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</strong>
            {hoverRows.map(({ l, v }) => (
              <span key={l.userId} className="rt-row">
                <span className="rt-swatch" style={{ background: profiles.get(l.userId)?.color }} aria-hidden>{profiles.get(l.userId)?.avatar}</span>
                <span className="rt-name">{profiles.get(l.userId)?.display_name}</span>
                <span className="rt-val">{v}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <figcaption className="race-legend">
        {[...order].reverse().map((li) => {
          const p = profiles.get(race.lines[li].userId);
          return (
            <span key={race.lines[li].userId} className="rl-item">
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
