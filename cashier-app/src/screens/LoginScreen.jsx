import React, { useState } from 'react';
import { LogIn, Eye, EyeOff, Store, AlertCircle } from 'lucide-react';
import StoreveuLogo from '../components/StoreveuLogo.jsx';
import { useAuthStore } from '../stores/useAuthStore.js';
import { useNavigate } from 'react-router-dom';
import './LoginScreen.css';

export default function LoginScreen() {
  const { login, loading, error } = useAuthStore();
  const navigate = useNavigate();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [netError, setNetError] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setNetError(false);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      if (!err.message || err.message.includes('Network') || err.message.includes('connect')) {
        setNetError(true);
      }
    }
  };

  return (
    <div className="ls-page">
      <div className="ls-app-id">POS &middot; localhost:5174</div>

      <div className="ls-card">
        <div className="ls-logo">
          <StoreveuLogo height={44} darkMode={true} showTagline={true} />
        </div>

        {/* Backend offline warning */}
        {netError && (
          <div className="ls-net-error">
            <AlertCircle size={15} color="var(--amber)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div className="ls-net-error-text">
              <strong>Cannot reach server.</strong> Make sure the backend is running:<br />
              <code className="ls-net-error-code">cd backend &amp;&amp; npm run dev</code>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="ls-field">
            <label className="ls-label">Email</label>
            <input
              type="email" required autoFocus
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="cashier@store.com"
              style={{ width: '100%' }}
            />
          </div>

          <div className="ls-field ls-field--pw">
            <label className="ls-label">Password</label>
            <div className="ls-pw-wrap">
              <input
                type={showPw ? 'text' : 'password'} required
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                style={{ width: '100%', paddingRight: '3rem' }}
              />
              <button type="button" onClick={() => setShowPw(v => !v)} className="ls-pw-toggle">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Auth error */}
          {error && !netError && (
            <div className="ls-auth-error">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="ls-submit">
            <LogIn size={16} />
            {loading ? 'Signing in\u2026' : 'Sign In'}
          </button>
        </form>

        <p className="ls-hint">Use the same credentials as the portal</p>
      </div>
    </div>
  );
}
