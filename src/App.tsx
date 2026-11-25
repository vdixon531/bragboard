import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { isConfigured } from './lib/supabase';
import { rememberNext, useAuth } from './lib/auth';
import { Spinner } from './components/ui';
import Login from './pages/Login';
import Welcome from './pages/Welcome';
import Home from './pages/Home';
import Post from './pages/Post';
import NewLeague from './pages/NewLeague';
import Join from './pages/Join';
import LeaguePage from './pages/LeaguePage';
import Me from './pages/Me';
import Setup from './pages/Setup';

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth();
  const loc = useLocation();
  if (loading || (session && !profile)) return <div className="center-screen"><Spinner /></div>;
  if (!session) {
    rememberNext(loc.pathname + loc.search);
    return <Navigate to="/login" replace />;
  }
  if (profile && !profile.onboarded && loc.pathname !== '/welcome') {
    rememberNext(loc.pathname + loc.search);
    return <Navigate to="/welcome" replace />;
  }
  return <>{children}</>;
}

function SetupNeeded() {
  return (
    <div className="center-screen">
      <div className="card narrow">
        <h1>Almost there</h1>
        <p>Bragboard needs its Supabase keys. Copy <code>.env.example</code> to <code>.env</code>, fill in
          <code> VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then restart the dev server.</p>
        <p className="muted">The README walks through the full setup.</p>
      </div>
    </div>
  );
}

const Demo = import.meta.env.DEV ? lazy(() => import('./pages/Demo')) : null;

export default function App() {
  if (Demo && window.location.pathname === '/demo') return <Suspense fallback={null}><Demo /></Suspense>;
  if (!isConfigured) return <SetupNeeded />;
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/welcome" element={<RequireAuth><Welcome /></RequireAuth>} />
      <Route path="/setup" element={<RequireAuth><Setup /></RequireAuth>} />
      <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
      <Route path="/post" element={<RequireAuth><Post /></RequireAuth>} />
      <Route path="/share" element={<RequireAuth><Post /></RequireAuth>} />
      <Route path="/new" element={<RequireAuth><NewLeague /></RequireAuth>} />
      <Route path="/join/:code" element={<RequireAuth><Join /></RequireAuth>} />
      <Route path="/league/:id" element={<RequireAuth><LeaguePage /></RequireAuth>} />
      <Route path="/me" element={<RequireAuth><Me /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
