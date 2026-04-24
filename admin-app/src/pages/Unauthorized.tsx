import { Link } from 'react-router-dom';
import { ShieldOff, ArrowLeft } from 'lucide-react';
import '../styles/admin.css';

interface UnauthorizedProps {
  required?: string | null;
}

export default function Unauthorized({ required }: UnauthorizedProps) {
  return (
    <div className="admin-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{
        maxWidth: 440, textAlign: 'center',
        padding: '2.5rem 2rem',
        background: 'var(--bg-card, #fff)',
        border: '1px solid var(--border-color, #e2e8f0)',
        borderRadius: 14,
        boxShadow: '0 10px 32px rgba(0,0,0,0.06)',
      }}>
        <div style={{
          width: 72, height: 72, margin: '0 auto 1rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: '50%', background: 'rgba(239,68,68,0.08)', color: '#ef4444',
        }}>
          <ShieldOff size={40} />
        </div>
        <h1 style={{ fontSize: '1.35rem', margin: '0 0 0.5rem' }}>Unauthorized Access</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0.4rem 0' }}>
          You don't have permission to view this page.
        </p>
        {required && (
          <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
            Required permission: <code style={{ background: 'var(--bg-secondary, #f1f5f9)', padding: '0.15rem 0.45rem', borderRadius: 4 }}>{required}</code>
          </p>
        )}
        <Link to="/dashboard" className="admin-btn-primary" style={{ marginTop: '1.5rem', textDecoration: 'none' }}>
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
