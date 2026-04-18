import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldOff, ArrowLeft } from 'lucide-react';
import './Unauthorized.css';

export default function Unauthorized({ required }) {
  return (
    <div className="p-page unauth-page">
      <div className="unauth-card">
        <div className="unauth-icon"><ShieldOff size={40} /></div>
        <h1>Unauthorized Access</h1>
        <p>You don't have permission to view this page.</p>
        {required && (
          <p className="unauth-key">
            Required permission: <code>{required}</code>
          </p>
        )}
        <p className="unauth-hint">
          If you believe this is a mistake, please contact your organization
          owner or administrator to adjust your role.
        </p>
        <Link to="/portal/realtime" className="p-btn p-btn-primary">
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
