import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { GAMES } from '@shared/games';
import { useAuth } from '../lib/auth';
import { SHORTCUT_URL } from '../components/PhoneSetup';

export const REPO_URL = 'https://github.com/vdixon531/bragboard';
const ISSUES_URL = `${REPO_URL}/issues`;

/** Small credit + links row. Shown on Login, Me and the info pages. */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>Made by Valmik</span>
      <span aria-hidden>·</span>
      <Link to="/faq">FAQ</Link>
      <span aria-hidden>·</span>
      <Link to="/privacy">Privacy &amp; Terms</Link>
      <span aria-hidden>·</span>
      <a href={REPO_URL} target="_blank" rel="noreferrer">Source code</a>
    </footer>
  );
}

/** Public page layout: readable signed in or out, so it can't use the tab-bar Shell. */
function InfoLayout({ title, children }: { title: string; children: ReactNode }) {
  const { session } = useAuth();
  useEffect(() => { document.title = `${title} · Bragboard`; return () => { document.title = 'Bragboard'; }; }, [title]);
  return (
    <div className="info">
      <header className="topbar">
        <Link to="/" className="wordmark" aria-label="Bragboard home">
          <img src="/icon.svg" alt="" width={28} height={28} /> Bragboard
        </Link>
        <Link to={session ? '/' : '/login'} className="btn ghost small">{session ? 'Back to app' : 'Sign in'}</Link>
      </header>
      <main className="page info-page">
        <h1>{title}</h1>
        {children}
        <SiteFooter />
      </main>
    </div>
  );
}

function Q({ q, children, open }: { q: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="faq-q" open={open}>
      <summary>{q}</summary>
      <div className="faq-a">{children}</div>
    </details>
  );
}

export function Faq() {
  return (
    <InfoLayout title="FAQ">
      <section className="card stack faq-hero">
        <p className="eyebrow">Start here</p>
        <h2>How do my scores get onto the leaderboard?</h2>
        <p>Finish your daily game, tap its <strong>Share</strong> button, and send the result to Bragboard. Bragboard reads the result,
          works out your points, and posts it to every league you’re in that plays that game. There are three ways to do it.</p>

        <h3>📱 iPhone: the Bragboard Shortcut (recommended)</h3>
        <p>Apple doesn’t let web apps show up in the iPhone share sheet, so Bragboard uses an Apple <strong>Shortcut</strong> instead.
          You set it up once. After that, posting takes one tap from any game.</p>
        <ol className="steps">
          <li>Sign in to Bragboard and open <strong>Me → Post from the share button → iPhone</strong>.</li>
          <li>Tap <strong>Copy token</strong>. This is your personal posting key.</li>
          <li>Open the <a href={SHORTCUT_URL} target="_blank" rel="noreferrer">Bragboard Shortcut</a> and tap <strong>Set Up Shortcut</strong>.</li>
          <li>It asks for a token and shows a placeholder. <strong>Delete the placeholder and paste your own token.</strong> Then tap <strong>Add Shortcut</strong>.</li>
          <li>Play a game, tap <strong>Share</strong>, scroll the row of apps to <strong>Post to Bragboard</strong>, and tap it. A notification confirms the post.</li>
        </ol>
        <p className="muted small">Can’t see <em>Post to Bragboard</em> in the share sheet? Scroll to the end of the app row, tap <strong>More</strong>, and add it to your favourites.</p>

        <h3>🤖 Android: install the app</h3>
        <ol className="steps">
          <li>Open Bragboard in <strong>Chrome</strong>, then menu (⋮) → <strong>Install app</strong> (or <em>Add to Home screen</em>).</li>
          <li>Play a game, tap <strong>Share</strong>, and choose <strong>Bragboard</strong>. Your score posts and the celebration plays.</li>
        </ol>

        <h3>📋 Anywhere: paste it</h3>
        <p>On any phone or computer, copy your game’s result, open Bragboard, tap <strong>Post</strong>, and paste. If Bragboard can’t read
          a result, you can enter the score by hand on the same screen.</p>
      </section>

      <h2 className="section-title">iPhone Shortcut questions</h2>
      <div className="faq-list">
        <Q q="What is the posting token, and is it safe?">
          <p>The token is a long random key that tells Bragboard the post is from you. The Shortcut sends it along with your result.
            It can only <em>post scores as you</em>. It can’t read your email, change your profile or see your leagues.</p>
          <p>Treat it like a password. Don’t paste it in group chats or GitHub issues. If it leaks, go to <strong>Me → Get a new token</strong>.
            The old one stops working right away, and you paste the new one into your Shortcut.</p>
        </Q>
        <Q q="A friend sent me their Shortcut. Can I use it?">
          <p>Yes, as long as you paste <strong>your own</strong> token when it asks. If you keep their token, your scores post under their name.</p>
        </Q>
        <Q q="The Shortcut says my token isn’t valid.">
          <p>You (or someone signed in as you) made a new token, or the token was pasted with a missing character. Copy it again from <strong>Me</strong>.
            Then open the Shortcuts app, tap ⋯ on <em>Post to Bragboard</em>, and replace the <code>token</code> value in the <em>Get Contents of URL</em> step.</p>
        </Q>
        <Q q="It says “didn’t recognise that result”.">
          <p>Some games only pass a link to the share sheet, not the result text. The Shortcut also checks your clipboard, so tap the game’s
            <strong> Copy</strong> button first and run the Shortcut again. If that still fails, paste the result in Bragboard’s <strong>Post</strong> screen.
            You can enter it by hand there too.</p>
        </Q>
        <Q q="It asked to allow the Shortcut to connect to a website.">
          <p>That’s iOS checking before the Shortcut sends your score to Bragboard’s server. Tap <strong>Always Allow</strong> so it doesn’t ask every time.</p>
        </Q>
        <Q q="I posted twice. Will it count twice?">
          <p>No. You get one score per game per day. A second post just tells you it’s already in. To fix a wrong score, remove it with the × on the league’s
            daily board and post again.</p>
        </Q>
        <Q q="Can I build the Shortcut myself?">
          <p>Yes. The full step-by-step recipe is under <strong>Me → iPhone → Build the Shortcut yourself</strong>.</p>
        </Q>
      </div>

      <h2 className="section-title">Leagues &amp; scoring</h2>
      <div className="faq-list">
        <Q q="Which games are supported?">
          <p>{GAMES.map((g) => `${g.emoji} ${g.name}`).join(' · ')}</p>
          <p>Each league picks which of these it plays.</p>
        </Q>
        <Q q="How are points worked out?">
          <p>Every game’s result becomes <strong>0–100 points</strong>, higher is better, so different games can be added together. For guess games
            like Wordle: 1 guess = 100, 2 = 90, 3 = 75, 4 = 60, 5 = 40, 6 = 20, a miss = 0. Score-based games (MapTap, TimeGuessr…) are scaled onto
            the same 0–100 range.</p>
        </Q>
        <Q q="What counts as a win?">
          <p>A win is first place in one game on one day when at least two people in the league played it. Ties share the place.</p>
        </Q>
        <Q q="What are the Week, Month and All time graphs?">
          <p>Each line is a player’s running points total over that stretch, so you can see exactly when someone pulled ahead. Tap or hover the graph
            to see everyone’s total on a given day. The table underneath has wins, games played and averages.</p>
        </Q>
        <Q q="What are awards?">
          <p>Badges for moments worth bragging about: the Daily Crown, Clean Sweep, Early Bird, streaks, First Try, and a few for embarrassing days
            too (hello, Wooden Spoon). They show up on the league page.</p>
        </Q>
        <Q q="When does “today” reset?">
          <p>At midnight <strong>your</strong> time. Scores are filed under the date on your phone when you post.</p>
        </Q>
        <Q q="How do I invite people?">
          <p>Open your league and tap <strong>Copy invite link</strong> or <strong>Share</strong>. Friends can also type the 6-letter invite code on their Home screen.</p>
        </Q>
      </div>

      <h2 className="section-title">Something else?</h2>
      <p>Found a bug or a game result that won’t post? <a href={ISSUES_URL} target="_blank" rel="noreferrer">Open an issue on GitHub</a> and paste the
        share text (never your token).</p>
    </InfoLayout>
  );
}

export function Privacy() {
  return (
    <InfoLayout title="Privacy & Terms">
      <p className="muted">Plain English. Last updated 24 November 2026.</p>

      <section className="card stack prose">
        <h2>What Bragboard stores</h2>
        <ul>
          <li><strong>Your email address</strong>: only to sign you in with a one-time link or code. Other players never see it.</li>
          <li><strong>Your profile</strong>: display name, avatar and colour.</li>
          <li><strong>Your scores</strong>: the game, the day, your result, the points, and the share text you posted.</li>
          <li><strong>Your leagues</strong>: which leagues you’re in, and the ones you made.</li>
          <li><strong>Your posting token</strong>: the private key your iPhone Shortcut uses to post as you.</li>
        </ul>

        <h2>Who can see it</h2>
        <p>People in a league with you can see your name, avatar and scores. Nobody else can, and nobody but you can see your token or email.</p>

        <h2>Where it lives</h2>
        <p>Data is stored with <a href="https://supabase.com" target="_blank" rel="noreferrer">Supabase</a>, and the app is served by a web host.
          There are no ads, no analytics trackers, and nothing is sold or shared with anyone else.
          Your browser keeps a few small settings on your device (like whether you’ve seen the phone setup).</p>

        <h2>Deleting your data</h2>
        <p>You can remove any of your scores from the league page, leave a league at any time, and delete leagues you own.
          To delete your whole account, <a href={ISSUES_URL} target="_blank" rel="noreferrer">open a GitHub issue</a> titled “Delete my account”
          with your display name. Don’t include your email or token. You’ll be asked to confirm from a reply, and everything tied to
          your account is then removed.</p>

        <h2>The terms</h2>
        <ul>
          <li>Bragboard is a free hobby project, provided as-is, with no guarantees about uptime or that every game’s result will parse.</li>
          <li>Be decent: don’t post fake scores to wind people up (too much), and don’t try to break or overload the service.</li>
          <li>Bragboard isn’t affiliated with any of the games it supports. Their names belong to their owners.</li>
          <li>These terms may change. Big changes will be noted on this page.</li>
        </ul>

        <h2>Open source</h2>
        <p>All of Bragboard’s code is public: <a href={REPO_URL} target="_blank" rel="noreferrer">github.com/vdixon531/bragboard</a>.</p>
      </section>
    </InfoLayout>
  );
}
