import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Phone, Search, ChevronRight, Loader, ArrowLeft } from 'lucide-react';
import { phoneLookup } from '../services/api';
import { toast } from 'react-toastify';
import './PhoneLookup.css';

const PhoneLookup = () => {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await phoneLookup(phone);
      toast.success('Account found! Proceeding to OTP...');
      navigate('/login');
    } catch (error) {
      toast.error(error.response?.data?.error || 'No account found with this phone number');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pl-page">
      <div className="glass-card animate-fade-in pl-card">
        <div className="pl-header">
          <h1 className="pl-title">Find Account</h1>
          <p className="pl-subtitle">Identify yourself with your phone number</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <div className="pl-input-wrap">
              <span className="pl-input-icon"><Phone size={18} /></span>
              <input
                type="tel"
                className="form-input pl-input-icon-pad"
                placeholder="+1 (234) 567 890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary pl-submit" disabled={loading}>
            {loading ? <Loader className="animate-spin" /> : <>Continue <ChevronRight size={18} className="pl-submit-icon" /></>}
          </button>
        </form>

        <div className="pl-footer">
           <Link to="/login" className="pl-back-link">
                <ArrowLeft size={16} className="pl-back-icon" /> Back to Log In
           </Link>
        </div>
      </div>
    </div>
  );
};

export default PhoneLookup;
