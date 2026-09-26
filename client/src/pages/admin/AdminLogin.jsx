import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icons';
import Logo from '../../components/Logo';
import { useToast } from '../../components/Toast';
import { api, setToken, getToken } from '../../api';

export default function AdminLogin() {
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // If a token is already in storage, skip the form.
  useEffect(() => {
    if (getToken()) navigate('/admin/dashboard', { replace: true });
  }, [navigate]);

  const submit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both your email and password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await api.admin.login(email.trim(), password);
      setToken(res.token);
      toast.success(`Welcome back, ${res.user.name}.`);
      navigate('/admin/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="login-sec">
      <div className="login-bg" aria-hidden="true" />
      <div className="container login-wrap">
        <div className="login-card reveal">
          <div className="login-head">
            <Logo size={56} />
            <h1 className="h3">Admin Login</h1>
            <p className="muted" style={{ fontSize: '0.92rem' }}>
              Sign in to manage products and enquiries.
            </p>
          </div>

          <form className="form" onSubmit={submit}>
            <div className="field">
              <label className="label" htmlFor="email">
                Email Address
              </label>
              <div className="input-icon">
                <Icon.Mail size={18} />
                <input
                  id="email"
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="maasaraswati449@gmail.com"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="password">
                Password
              </label>
              <div className="input-icon">
                <Icon.Lock size={18} />
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
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
              className="btn btn-red btn-block btn-lg"
              disabled={busy}
            >
              {busy ? (
                <>
                  <span className="btn-spin" /> Signing in…
                </>
              ) : (
                <>
                  <Icon.Lock size={18} /> Sign In
                </>
              )}
            </button>
          </form>

          <div className="login-hint">
            <Icon.Info size={16} />
            <p>
              <strong>Default login:</strong> maasaraswati449@gmail.com / admin123
              <br />
              <span className="muted">
                Change these in <code>server/.env</code> before going live.
              </span>
            </p>
          </div>

          <Link to="/" className="login-back">
            <Icon.ArrowLeft size={16} /> Back to website
          </Link>
        </div>
      </div>
    </section>
  );
}
