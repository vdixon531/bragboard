import { useEffect, useState } from 'react';
import { getShareToken, rotateShareToken } from '../lib/api';
import { SUPABASE_URL } from '../lib/supabase';
import { CopyButton } from './ui';

export const SHORTCUT_URL = 'https://www.icloud.com/shortcuts/95146a631c214708af85ca093db5d342';

const SETUP_KEY = 'bb.phoneSetupSeen';
/** Per device: setup is about this phone, so a new phone should be nudged again. */
export const phoneSetupSeen = () => { try { return localStorage.getItem(SETUP_KEY) === '1'; } catch { return false; } };
export const markPhoneSetupSeen = () => { try { localStorage.setItem(SETUP_KEY, '1'); } catch { /* ignore */ } };

interface InstallPrompt extends Event { prompt: () => Promise<void> }

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** The iPhone / Android instructions for posting from a game's Share button. Used on /setup and Me. */
export function PhoneSetup() {
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

  return (
    <>
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
          <p>iPhones don’t let web apps appear in the share sheet, so Bragboard uses a Shortcut. It takes about a minute.</p>

          <ol className="steps">
            <li>
              Copy your posting token below.
            </li>
          </ol>
          <div className="token-box">
            <span className="label">Your posting token</span>
            <code className="mono">{token ? (showToken ? token : '•'.repeat(12) + token.slice(-4)) : 'Loading…'}</code>
            <div className="row gap">
              <button type="button" className="btn ghost small" onClick={() => setShowToken((v) => !v)}>{showToken ? 'Hide' : 'Show'}</button>
              {token && <CopyButton text={token} label="Copy token" />}
            </div>
            <p className="muted small">Keep this private. Anyone with it can post scores as you.</p>
          </div>
          <ol className="steps" start={2}>
            <li>
              Add the Shortcut:{' '}
              <a className="btn primary small" href={SHORTCUT_URL} target="_blank" rel="noreferrer">Add the Shortcut</a>
            </li>
            <li>Tap <strong>Set Up Shortcut</strong>. When it asks for a token, <strong>replace the placeholder with the token you copied</strong>, then tap <strong>Add Shortcut</strong>.</li>
            <li>Finish a game → <strong>Share</strong> → scroll the app row to <strong>Post to Bragboard</strong>. A notification tells you it posted.</li>
            <li className="muted">First time, iOS asks to allow the Shortcut to contact Bragboard. Tap <em>Always Allow</em>.</li>
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
    </>
  );
}
