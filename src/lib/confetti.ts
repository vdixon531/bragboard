// Tiny canvas confetti. Shapes can be emoji, so each game can burst its own (🦐, 🍞, 📍...).
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Bit {
  x: number; y: number; vx: number; vy: number; rot: number; vr: number;
  w: number; h: number; color: string; emoji?: string; life: number;
}

export function burst(opts: { colors: string[]; emoji?: string[]; count?: number; originY?: number } ) {
  if (reduced() || typeof document === 'undefined') return;
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = window.innerWidth, H = window.innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  const count = opts.count ?? 140;
  const oy = (opts.originY ?? 0.35) * H;
  const bits: Bit[] = Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
    const speed = 7 + Math.random() * 9;
    const useEmoji = opts.emoji?.length && i % 6 === 0;
    return {
      x: W / 2 + (Math.random() - 0.5) * 60, y: oy,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      w: 6 + Math.random() * 6, h: 8 + Math.random() * 8,
      color: opts.colors[i % opts.colors.length],
      emoji: useEmoji ? opts.emoji![i % opts.emoji!.length] : undefined,
      life: 1,
    };
  });

  let frame = 0;
  const tick = () => {
    frame++;
    ctx.clearRect(0, 0, W, H);
    let alive = 0;
    for (const b of bits) {
      b.vy += 0.28; b.vx *= 0.985; b.vy *= 0.985;
      b.x += b.vx; b.y += b.vy; b.rot += b.vr;
      if (frame > 90) b.life -= 0.012;
      if (b.life <= 0 || b.y > H + 40) continue;
      alive++;
      ctx.save();
      ctx.globalAlpha = Math.max(0, b.life);
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      if (b.emoji) {
        ctx.font = '22px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.emoji, 0, 8);
      } else {
        ctx.fillStyle = b.color;
        ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h * Math.abs(Math.cos(b.rot * 2)));
      }
      ctx.restore();
    }
    if (alive > 0 && frame < 400) requestAnimationFrame(tick);
    else canvas.remove();
  };
  requestAnimationFrame(tick);
}
