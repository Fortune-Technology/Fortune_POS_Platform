/**
 * POSConfig — Tabbed hub for POS configuration pages
 * Tabs: Layout & Settings, Receipt Settings, Label Design
 *
 * "Quick Keys" tab was REMOVED in Session 37 — the WYSIWYG Quick Buttons
 * builder at /portal/quick-buttons supersedes the old QuickAccess page
 * (folders-only, no drag/resize). The legacy `store.pos.quickFolders`
 * data in existing stores is still rendered by the cashier-app as a
 * fallback, but new edits happen exclusively in the new builder.
 */
import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Monitor, FileText, Tag } from 'lucide-react';
import POSSettings from './POSSettings';
import ReceiptSettings from './ReceiptSettings';
import LabelDesign from './LabelDesign';
import '../styles/portal.css';

const TABS = [
  { key: 'layout',     label: 'Layout & Settings', icon: <Monitor size={14} /> },
  { key: 'receipts',   label: 'Receipt Settings',  icon: <FileText size={14} /> },
  { key: 'labels',     label: 'Label Design',      icon: <Tag size={14} /> },
];

export default function POSConfig() {
  const [searchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  // Legacy ?tab=quick-keys links from the old sidebar redirect to the new builder
  // via the App.jsx route, but also fall back to layout tab if someone hits it directly.
  const initialTab = rawTab === 'quick-keys' ? 'layout' : (rawTab || 'layout');
  const [tab, setTab] = useState(initialTab);

  return (
    <div className="p-page">
      <div className="p-header">
        <div className="p-header-left">
          <div className="p-header-icon"><Monitor size={22} /></div>
          <div>
            <h1 className="p-title">POS Configuration</h1>
            <p className="p-subtitle">Manage your point of sale layout, receipts, and label design</p>
          </div>
        </div>
      </div>

      <div className="p-tabs">
        {TABS.map(t => (
          <button key={t.key} className={`p-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'layout'     && <POSSettings embedded />}
      {tab === 'receipts'   && <ReceiptSettings embedded />}
      {tab === 'labels'     && <LabelDesign embedded />}
    </div>
  );
}
