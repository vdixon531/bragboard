import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { takeNext, useAuth } from '../lib/auth';
import { updateProfile } from '../lib/api';
import { Avatar } from '../components/ui';

export const AVATARS = ['🦊', '🐙', '🦐', '🐸', '🦉', '🐼', '🦖', '🐝', '🦄', '🐢', '🦩', '🐳', '🍞', '✈️', '🌍', '🎯', '👾', '🌵', '🍕', '🚀', '🐵', '🐶', '🐱', '🦁', '🐯', '🐨', '🐧', '🐷', '🐰', '🦈'];
export const COLORS = ['#FF6B2C', '#F5B700', '#19A974', '#0F6B5C', '#2F7FE8', '#6C5CE7', '#B784C9', '#E5484D', '#0A2340', '#8C3B12'];

export function ProfileFields({ name, setName, avatar, setAvatar, color, setColor }: {
  name: string; setName: (v: string) => void; avatar: string; setAvatar: (v: string) => void; color: string; setColor: (v: string) => void;
}) {
  return (
    <>
      <div className="preview-row">
        <Avatar profile={{ id: '', display_name: name, avatar, color, onboarded: true }} size={64} />
        <strong className="preview-name">{name || 'Your name'}</strong>
      </div>
      <label htmlFor="name">Name your friends will see</label>
      <input id="name" maxLength={32} required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sam" />
      <fieldset className="picker">
        <legend>Avatar</legend>
        <div className="emoji-grid">
          {AVATARS.map((a) => (
            <button key={a} type="button" className={a === avatar ? 'on' : ''} aria-pressed={a === avatar} onClick={() => setAvatar(a)}>{a}</button>
          ))}
        </div>
      </fieldset>
      <fieldset className="picker">
        <legend>Colour</legend>
        <div className="swatches">
          {COLORS.map((c) => (
            <button key={c} type="button" className={c === color ? 'on' : ''} aria-pressed={c === color} aria-label={c} style={{ background: c }} onClick={() => setColor(c)} />
          ))}
        </div>
      </fieldset>
    </>
  );
}

export default function Welcome() {
  const { session, profile, refreshProfile } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState(profile?.display_name === 'New player' ? '' : profile?.display_name ?? '');
  const [avatar, setAvatar] = useState(profile?.avatar ?? '🦊');
  const [color, setColor] = useState(profile?.color ?? '#FF6B2C');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    setBusy(true);
    try {
      await updateProfile(session.user.id, { display_name: name.trim(), avatar, color, onboarded: true });
      await refreshProfile();
      nav(takeNext() ?? '/', { replace: true });
    } catch (e2) {
      setErr((e2 as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <form className="card narrow stack" onSubmit={save}>
        <h1>Make it yours</h1>
        <p className="muted">This is how you’ll show up on every leaderboard.</p>
        <ProfileFields {...{ name, setName, avatar, setAvatar, color, setColor }} />
        <button className="btn primary" disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Let’s play'}</button>
        {err && <p className="error">{err}</p>}
      </form>
    </div>
  );
}
