import { Mail } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ZeonLogo } from '@/view/brand/ZeonLogo';
import { appIcon } from '@/view/icons';
import { useAuth } from './AuthProvider';

function GoogleIcon() {
  return (
    <svg className="auth-google__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function LoginPage() {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [step, setStep] = useState<'email' | 'password'>('email');
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const emailReady = isValidEmail(email.trim());
  const passwordReady = password.length >= 6;

  const handleGoogleSignIn = async () => {
    setError(null);
    setMessage(null);
    setGoogleSubmitting(true);

    const result = await signInWithGoogle();
    setGoogleSubmitting(false);

    if (result.error) setError(result.error);
  };

  const handleEmailContinue = (event: FormEvent) => {
    event.preventDefault();
    if (!emailReady) return;

    setError(null);
    setMessage(null);
    setStep('password');
  };

  const handlePasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!passwordReady) return;

    setError(null);
    setMessage(null);
    setSubmitting(true);

    const result =
      mode === 'sign-in'
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password);

    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (mode === 'sign-up') {
      setMessage('Account created. Check your email if confirmation is required, then sign in.');
      setMode('sign-in');
      setPassword('');
    }
  };

  const goBackToEmail = () => {
    setStep('email');
    setPassword('');
    setError(null);
    setMessage(null);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-card__welcome">
          Welcome to <ZeonLogo className="auth-card__wordmark" />
        </h1>

        {step === 'email' ? (
          <>
            <form className="auth-form" onSubmit={handleEmailContinue}>
              <label className="auth-form__field">
                <span className="auth-form__label">Email</span>
                <span className="auth-form__input-wrap">
                  <Mail {...appIcon('auth-form__input-icon')} />
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="Enter your email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </span>
              </label>

              <button
                className="auth-form__submit"
                type="submit"
                disabled={!emailReady || submitting || googleSubmitting}
              >
                Continue
              </button>
            </form>

            <div className="auth-divider">
              <span>or</span>
            </div>

            <button
              type="button"
              className="auth-google"
              onClick={handleGoogleSignIn}
              disabled={submitting || googleSubmitting}
            >
              <GoogleIcon />
              {googleSubmitting ? 'Redirecting…' : 'Continue with Google'}
            </button>
          </>
        ) : (
          <form className="auth-form" onSubmit={handlePasswordSubmit}>
            <p className="auth-card__email-hint">{email.trim()}</p>

            <label className="auth-form__field">
              <span className="auth-form__label">Password</span>
              <input
                type="password"
                className="auth-form__input-standalone"
                autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                required
                minLength={6}
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>

            {error ? <p className="auth-form__error">{error}</p> : null}
            {message ? <p className="auth-form__message">{message}</p> : null}

            <button
              className="auth-form__submit"
              type="submit"
              disabled={!passwordReady || submitting}
            >
              {submitting ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
            </button>

            <button type="button" className="auth-card__toggle" onClick={goBackToEmail}>
              Use a different email
            </button>

            <button
              type="button"
              className="auth-card__toggle"
              onClick={() => {
                setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
                setError(null);
                setMessage(null);
              }}
            >
              {mode === 'sign-in' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
            </button>
          </form>
        )}

        {step === 'email' && error ? <p className="auth-form__error auth-form__error--spaced">{error}</p> : null}

        <p className="auth-card__legal">
          By continuing, you agree to use Zeon for your personal mind maps.
        </p>
      </div>
    </div>
  );
}
