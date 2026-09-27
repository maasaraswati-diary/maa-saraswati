import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icons';
import Logo from '../../components/Logo';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import { isFirebaseConfigured } from '../../firebase';
import { usePageMeta } from '../../hooks';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Partner sign-in / sign-up.
 *
 * Any customer can create an account and add their own products. The shop owner
 * reviews each one, so a product only appears on the storefront after approval.
 */
export default function PartnerLogin() {
  // The panel is not for search engines.
  usePageMeta({ title: 'Partner Sign In', description: 'Sign in to manage your products.', noIndex: true });
  const { signIn, signUp, resetPassword, user, isOwner } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [mode, setMode] = useState('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Already signed in — send them straight to the dashboard.
    if (user) navigate('/partner/products', { replace: true });
  }, [user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!EMAIL_RE.test(email.trim())) {
      return setError('Please enter a valid email address.');
    }
    if (password.length < 6) {
      return setError('Password must be at least 6 characters.');
    }
    if (mode === 'signup' && name.trim().length < 2) {
      return setError('Please tell us your name or shop name.');
    }

    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
        toast.success('Welcome back! You are signed in.');
      } else {
        await signUp(name.trim(), email.trim(), password);
        toast.success('Account created. Add your first product!');
      }
    } catch (err) {
      const code = err?.code || '';
      setError(
        {
          'auth/invalid-credential': 'Email or password is incorrect.',
          'auth/email-already-in-use': 'An account with this email already exists.',
          'auth/weak-password': 'Please choose a stronger password (6+ characters).',
          'auth/too-many-requests': 'Too many attempts. Please wait a minute.',
          'auth/network-request-failed': 'No internet connection right now.',
        }[code] || err?.message || 'Could not sign you in. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!EMAIL_RE.test(email.trim())) {
      return toast.error('Enter your email address first, then request a reset.');
    }
    try {
      await resetPassword(email.trim());
      toast.success('Password reset email sent. Please check your inbox.');
    } catch (err) {
      toast.error(err?.message || 'Could not send the reset email.');
    }
  };

  return (
    <section className="login-sec">
      <div className="login-bg" aria-hidden="true" />
      <div className="container login-wrap">
        <div className="login-card reveal">
          <div className="login-head">
            <Logo size={56} />
            <h1 className="h3">
              {mode === 'signin' ? 'Partner Sign In' : 'Create Partner Account'}
            </h1>
            <p className="muted" style={{ fontSize: '0.92rem' }}>
              {mode === 'signin'
                ? 'Sign in to manage your products.'
                : "Add the products from your shop — they go live once the owner approves them!"}
            </p>
          </div>

          {!isFirebaseConfigured && (
            <div className="login-error" style={{ marginBottom: 16 }}>
              <Icon.Alert size={17} />
              <span>
                Sign-in is not ready yet. Email and password still need to
                be enabled in the Firebase console.
              </span>
            </div>
          )}

          <form className="form" onSubmit={submit}>
            {mode === 'signup' && (
              <div className="field">
                <label className="label" htmlFor="pname">
                  Your Name / Shop Name
                </label>
                <input
                  id="pname"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Verma Dairy"
                  autoComplete="name"
                />
              </div>
            )}

            <div className="field">
              <label className="label" htmlFor="pemail">
                Email Address
              </label>
              <div className="input-icon">
                <Icon.Mail size={18} />
                <input
                  id="pemail"
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="ppass">
                Password
              </label>
              <div className="input-icon">
                <Icon.Lock size={18} />
                <input
                  id="ppass"
                  type={showPass ? 'text' : 'password'}
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  className="pass-toggle"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  <Icon.Info size={17} />
                </button>
              </div>
            </div>

            {error && (
              <div className="login-error">
                <Icon.Alert size={17} /> {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-brand btn-block btn-lg"
              disabled={busy || !isFirebaseConfigured}
            >
              {busy ? (
                <>
                  <span className="btn-spin" /> Please wait…
                </>
              ) : mode === 'signin' ? (
                <>
                  <Icon.Lock size={18} /> Sign In
                </>
              ) : (
                <>
                  <Icon.Sparkle size={18} /> Create Account
                </>
              )}
            </button>
          </form>

          {mode === 'signin' && (
            <button className="link-btn" onClick={forgot} type="button">
              Forgot your password? Reset it
            </button>
          )}

          <div className="auth-switch">
            {mode === 'signin' ? (
              <>
                No account yet?{' '}
                <button type="button" onClick={() => setMode('signup')}>
                  Create a free account
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button type="button" onClick={() => setMode('signin')}>
                  Sign in
                </button>
              </>
            )}
          </div>

          {isOwner && (
            <div className="login-hint">
              <Icon.Info size={16} />
              <p>
                You are the owner — every product and enquiry is visible to you.
              </p>
            </div>
          )}

          <Link to="/" className="login-back">
            <Icon.ArrowLeft size={16} /> Back to website
          </Link>
        </div>
      </div>
    </section>
  );
}
