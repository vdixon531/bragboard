import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { takeNext, useAuth } from '../lib/auth';
import { GAMES } from '@shared/games';
import { gameVars } from '../components/ui';
import { SiteFooter } from './Info';

export default function Login() {
  const { session } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'email' | 'sent'>('email');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (session) nav(takeNext() ?? '/', { replace: true });
  }, [session, nav]);

  async function send(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/login` },
    });
    setBusy(false);
    if (error) setErr(error.message);
    else setStage('sent');
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr('');
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setErr('That code didn’t work. Check the latest email, or send a new one.');
  }

  return (
    <div className="login">
      <div className="login-marquee" aria-hidden>
        <div className="marquee-track">
          {[...GAMES, ...GAMES].map((g, i) => (
            <span key={i} className="marquee-chip" style={gameVars(g)}>{g.emoji} {g.name}</span>
          ))}
        </div>
      </div>
      <div className="login-card">
        <img src="/icon.svg" alt="" width={64} height={64} className="login-logo" />
        <h1>Bragboard</h1>
        <p className="lede">Your group chat’s daily games, on one leaderboard. Post your score from the share button and see who’s winning.</p>

        {stage === 'email' ? (
          <form onSubmit={send} className="stack">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" required placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn primary" disabled={busy}>{busy ? 'Sending…' : 'Email me a sign-in link'}</button>
          </form>
        ) : (
          <form onSubmit={verify} className="stack">
            <p>We sent a link and a 6-digit code to <strong>{email}</strong>.</p>
            <p className="muted small">Using Bragboard from your home screen? Type the code here, because the link opens in your browser instead.</p>
            <label htmlFor="code">6-digit code</label>
            <input id="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6}
              placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} className="code-input" />
            <button className="btn primary" disabled={busy || code.length < 6}>{busy ? 'Checking…' : 'Sign in'}</button>
            <button type="button" className="btn ghost" onClick={() => { setStage('email'); setCode(''); }}>Use a different email</button>
          </form>
        )}
        {err && <p className="error" role="alert">{err}</p>}
      </div>
      <SiteFooter />
    </div>
  );
}
