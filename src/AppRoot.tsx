import { App } from './App';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { LoginPage } from './auth/LoginPage';
import { isDevAuthSkipped, isSupabaseConfigured } from './config/env';

function AuthenticatedApp() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="auth-page">
        <p className="auth-page__loading">Loading Zeon…</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <App mode="cloud" onSignOut={signOut} />;
}

export function AppRoot() {
  if (!isSupabaseConfigured() || isDevAuthSkipped()) {
    return <App mode="local" />;
  }

  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}
