/**
 * LotteryTabBar — shared top tab strip for every lottery view.
 *
 * Single source of truth for the /portal/lottery tab navigation. Used by
 * both LotteryBackOffice (the Daily 3-column view) and Lottery.jsx (the
 * "advanced" tabs — Shift Reports, Weekly Settlement, Reports, Commission).
 *
 * Each tab is a URL search param (`?tab=daily`, `?tab=reports`, etc.) so
 * a page refresh preserves the user's selected tab — fixing the UX bug
 * reported April 23. Deep links like /portal/lottery?tab=reports&from=...
 * work too.
 *
 * NOTE (April 2026 — Session 44b): removed `catalog` and `settings` tabs.
 *   • Ticket Catalog is superadmin-managed (Admin → States) and adds no
 *     value to store users; cataloged tickets surface automatically when
 *     receiving books.
 *   • Settings (state, commission, sellDirection) moved to Account → Store
 *     Settings → Lottery section so all store-level config lives in one
 *     place. The /portal/lottery?tab=settings|catalog deep-links now
 *     redirect to ?tab=daily via LotteryRouter.
 */

import React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Ticket, FileText, ListChecks, Receipt, BarChart2,
} from 'lucide-react';
import './LotteryTabBar.css';

const TABS = [
  { key: 'daily',            label: 'Daily',             icon: Ticket     },
  { key: 'shift-reports',    label: 'Shift Reports',     icon: FileText   },
  { key: 'weekly',           label: 'Weekly Settlement', icon: ListChecks },
  { key: 'reports',          label: 'Reports',           icon: BarChart2  },
  { key: 'commission',       label: 'Commission',        icon: Receipt    },
];

export default function LotteryTabBar({ active }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeKey = active || searchParams.get('tab') || 'daily';

  const switchTo = (key) => {
    // When switching tabs, keep the store/date if they were set, but drop
    // daily-only params (`pane`, `mode`) that don't apply to other views.
    const next = new URLSearchParams();
    next.set('tab', key);
    const keep = ['date', 'storeId', 'from', 'to'];
    for (const k of keep) {
      const v = searchParams.get(k);
      if (v) next.set(k, v);
    }
    setSearchParams(next);
  };

  return (
    <div className="lotabs" role="tablist" aria-label="Lottery sections">
      {TABS.map(t => {
        const Icon = t.icon;
        const isActive = t.key === activeKey;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`lotabs-btn ${isActive ? 'lotabs-btn--active' : ''}`}
            onClick={() => switchTo(t.key)}
          >
            <Icon size={14} />
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export { TABS as LOTTERY_TABS };
