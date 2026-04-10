import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import './BillingBanner.css';

export default function BillingBanner() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    api.get('/billing/subscription')
      .then(r => setStatus(r.data?.status))
      .catch(() => {});
  }, []);

  if (!status || (status !== 'past_due' && status !== 'suspended')) return null;

  const isPastDue = status === 'past_due';

  return (
    <div className={`bb-banner ${isPastDue ? 'bb-banner--past-due' : 'bb-banner--suspended'}`}>
      <span>
        {isPastDue
          ? 'Your subscription payment is past due. Please update your payment method to avoid service interruption.'
          : 'Your account has been suspended due to failed payments. Update your billing info to restore access.'}
      </span>
      <Link to="/portal/billing" className="bb-link">
        Update Billing
      </Link>
    </div>
  );
}
