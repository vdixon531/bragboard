import { useNavigate } from 'react-router-dom';
import { takeNext } from '../lib/auth';
import { PhoneSetup, markPhoneSetupSeen } from '../components/PhoneSetup';

/** Shown once right after onboarding: get the Share button working before anything else. */
export default function Setup() {
  const nav = useNavigate();
  const go = () => { markPhoneSetupSeen(); nav(takeNext() ?? '/', { replace: true }); };

  return (
    <div className="center-screen">
      <section className="card narrow stack">
        <p className="eyebrow">Step 2 of 2</p>
        <h1>Post from your game’s Share button</h1>
        <p className="muted">Set this up once. After that, finishing a game and tapping <strong>Share</strong> sends your score straight to your leagues. No copying, no typing.</p>
        <PhoneSetup />
        <button className="btn primary" onClick={go}>I’m set up</button>
        <button className="btn ghost" onClick={go}>Skip for now</button>
        <p className="muted small">You can always find this again under <strong>Me</strong>.</p>
      </section>
    </div>
  );
}
