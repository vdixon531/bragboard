import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { getShareToken, rotateShareToken, updateProfile } from '../lib/api';
import { SUPABASE_URL } from '../lib/supabase';
import { CopyButton, Shell } from '../components/ui';
import { ProfileFields } from './Welcome';

interface InstallPrompt extends Event { prompt: () => Promise<void> }

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export default function Me() {
  const { session, profile, refreshProfile, signOut } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [avatar, setAvatar] = useState(profile?.avatar ?? '🦊');
  const [color, setColor] = useState(profile?.color ?? '#FF6B2C');
  const [saved, setSaved] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [tab, setTab] = useState<'ios' | 'android'>(isIOS() ? 'ios' : 'android');
  const [installEvt, setInstallEvt] = useState<InstallPrompt | null>(null);

  useEffect(() => { getShareToken().then(setToken).catch(() => setToken(null)); }, []);
  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setInstallEvt(e as InstallPrompt); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  const endpoint = `${SUPABASE_URL}/functions/v1/submit-score`;

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
        <div className="segmented" role="tablist">
          <button role="tab" aria-selected={tab === 'ios'} className={tab === 'ios' ? 'on' : ''} onClick={() => setTab('ios')}>iPhone</button>
          <button role="tab" aria-selected={tab === 'android'} className={tab === 'android' ? 'on' : ''} onClick={() => setTab('android')}>Android</button>
        </div>

        {tab === 'android' ? (
          <ol className="steps">
            <li>Open Bragboard in <strong>Chrome</strong>.</li>
            <li>
              Install it to your home screen.{' '}
              {installEvt
                ? <button className="btn primary small" onClick={() => installEvt.prompt()}>Install Bragboard</button>
                : <>Use the menu (⋮) → <em>Install app</em> or <em>Add to Home screen</em>.</>}
            </li>
            <li>Finish a game, tap <strong>Share</strong>, and pick <strong>Bragboard</strong>. Your score posts and the celebration plays.</li>
            <li className="muted">If a game only offers <em>Copy</em>, open Bragboard and tap <strong>Paste from clipboard</strong>.</li>
          </ol>
        ) : (
          <>
            <p>iPhones don’t let web apps appear in the share sheet, so Bragboard uses a Shortcut. It takes two minutes to set up.</p>
            <div className="token-box">
              <span className="label">Your posting token</span>
              <code className="mono">{token ? (showToken ? token : '•'.repeat(12) + token.slice(-4)) : 'Loading…'}</code>
              <div className="row gap">
                <button type="button" className="btn ghost small" onClick={() => setShowToken((v) => !v)}>{showToken ? 'Hide' : 'Show'}</button>
                {token && <CopyButton text={token} label="Copy token" />}
              </div>
              <p className="muted small">Keep this private. Anyone with it can post scores as you.</p>
            </div>

            <h3 className="section-title">If a friend sent you the Shortcut link</h3>
            <ol className="steps">
              <li>Open the link and tap <strong>Add Shortcut</strong>.</li>
              <li>When it asks for your token, paste the one above.</li>
              <li>Finish a game → <strong>Share</strong> → scroll the app row to <strong>Post to Bragboard</strong>. A notification tells you your rank.</li>
            </ol>

            <details className="build">
              <summary>Build the Shortcut yourself</summary>
              <ol className="steps">
                <li>Open <strong>Shortcuts</strong> → <strong>+</strong>. Name it <em>Post to Bragboard</em>.</li>
                <li>Tap <strong>ⓘ</strong> → turn on <strong>Show in Share Sheet</strong>. Set it to receive <em>Text</em> and <em>URLs</em>. Under “If there’s no input”, choose <strong>Get Clipboard</strong>.</li>
                <li>Add <strong>Combine Text</strong>: <em>Shortcut Input</em>, separator <strong>New Lines</strong>. (Games share text and a link as separate items; this keeps both.)</li>
                <li>Add <strong>Get Clipboard</strong>. (Backup for games whose Share button only passes a link.)</li>
                <li>Add <strong>Format Date</strong>: Current Date, Custom format <code>yyyy-MM-dd</code>.</li>
                <li>
                  Add <strong>Get Contents of URL</strong>:
                  <div className="kv"><span>URL</span><code className="mono wrap">{endpoint}</code><CopyButton text={endpoint} /></div>
                  Method <strong>POST</strong>, Request Body <strong>JSON</strong>, with four Text fields:
                  <ul>
                    <li><code>token</code> → your token (paste it)</li>
                    <li><code>text</code> → <em>Combined Text</em></li>
                    <li><code>clip</code> → <em>Clipboard</em></li>
                    <li><code>day</code> → <em>Formatted Date</em></li>
                  </ul>
                </li>
                <li>Add <strong>Get Dictionary Value</strong>: key <code>message</code> from <em>Contents of URL</em>.</li>
                <li>Add <strong>Show Notification</strong> with <em>Dictionary Value</em>.</li>
                <li>
                  To share it with friends: tap <strong>Share → Copy iCloud Link</strong>. In the Shortcut’s ⓘ → <em>Setup</em>, add an
                  Import Question on the token field first, so each friend pastes their own token when they add it.
                </li>
              </ol>
            </details>

            {!confirmRotate ? (
              <button className="btn ghost small" onClick={() => setConfirmRotate(true)}>Get a new token…</button>
            ) : (
              <div className="card warn stack">
                <p>Your current Shortcut stops working until you paste the new token into it.</p>
                <div className="row gap">
                  <button className="btn primary small" onClick={async () => { setToken(await rotateShareToken()); setConfirmRotate(false); setShowToken(true); }}>Make a new token</button>
                  <button className="btn ghost small" onClick={() => setConfirmRotate(false)}>Cancel</button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <section className="card stack">
        <p className="muted small">Signed in as {session?.user.email}</p>
        <button className="btn ghost danger" onClick={signOut}>Sign out</button>
      </section>
    </Shell>
  );
}
