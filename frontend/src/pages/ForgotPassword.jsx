import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Send, CheckCircle } from 'lucide-react';
import { forgotPassword } from '../services/api';
import { toast } from 'react-toastify';
import StoreveuLogo from '../components/StoreveuLogo';
import './ForgotPassword.css';

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email?.trim());

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleEmailBlur = () => {
    if (email && !validateEmail(email)) {
      setErrors({ email: 'Please enter a valid email address' });
    } else {
      setErrors({});
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (email && !validateEmail(email)) {
      setErrors({ email: 'Please enter a valid email address' });
      return;
    }
    setLoading(true);
    try {
      await forgotPassword(email);
      setSubmitted(true);
      toast.success('Reset email sent!');
    } catch (error) {
      toast.error('Error sending reset email');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="fp-page">
        <div className="glass-card animate-fade-in fp-card fp-card--success">
          <div className="fp-success-icon">
            <CheckCircle size={40} />
          </div>
          <h1 className="fp-success-title">Check your email</h1>
          <p className="fp-success-msg">We've sent a password reset link to <strong>{email}</strong>.</p>
          <Link to="/login" className="btn btn-secondary fp-back-btn">
            <ArrowLeft size={18} className="fp-back-icon" /> Back to Log In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fp-page">
      <div className="glass-card animate-fade-in fp-card">
        <div className="fp-header">
          <div className="fp-logo-row">
            <StoreveuLogo height={44} darkMode={true} showTagline={true} />
          </div>
          <h1 className="fp-form-title">Reset Password</h1>
          <p className="fp-form-subtitle">Enter your email to receive a reset link</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div className="fp-input-wrap">
              <span className="fp-input-icon"><Mail size={18} /></span>
              <input
                type="email"
                className={`form-input fp-input-icon-pad ${errors.email ? 'fp-input--error' : ''}`}
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={handleEmailBlur}
                required
              />
            </div>
            {errors.email && <p className="fp-field-error">{errors.email}</p>}
          </div>

          <button type="submit" className="btn btn-primary fp-submit" disabled={loading}>
            {loading ? 'Sending...' : <>Send Reset Link <Send size={18} className="fp-submit-icon" /></>}
          </button>
        </form>

        <div className="fp-footer">
           <Link to="/login" className="fp-back-link">
                <ArrowLeft size={16} className="fp-back-link-icon" /> Back to Log In
           </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
