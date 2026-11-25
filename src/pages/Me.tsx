import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { updateProfile } from '../lib/api';
import { Shell } from '../components/ui';
import { PhoneSetup } from '../components/PhoneSetup';
import { ProfileFields } from './Welcome';
import { SiteFooter } from './Info';

export default function Me() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [avatar, setAvatar] = useState(profile?.avatar ?? '🦊');
  const [color, setColor] = useState(profile?.color ?? '#FF6B2C');
  const [saved, setSaved] = useState(false);
  const { hash } = useLocation();

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    await updateProfile(session.user.id, { display_name: name.trim(), avatar, color });
    await refreshProfile();
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <Shell>
      <h1>Me</h1>

      <form className="card stack" onSubmit={save}>
        <ProfileFields {...{ name, setName, avatar, setAvatar, color, setColor }} />
        <button className="btn primary" disabled={!name.trim()}>{saved ? 'Saved ✓' : 'Save profile'}</button>
      </form>

      <section className="card stack" id="phone">
        <h2 className="section-title">Post from the share button</h2>
        <p className="muted">Set this up once. After that, finishing a game and tapping <strong>Share</strong> sends your score here.</p>
        <PhoneSetup />
      </section>

      <section className="card stack">
        <p className="muted small">Signed in as {session?.user.email}</p>
        <button className="btn ghost danger" onClick={signOut}>Sign out</button>
      </section>

      <SiteFooter />
    </Shell>
  );
}
