/**
 * LotteryRouter — picks the right lottery view based on the ?tab= URL
 * param, and owns the shared tab bar at the top.
 *
 *   /portal/lottery                  → ?tab=daily (default) → LotteryBackOffice
 *   /portal/lottery?tab=daily        → LotteryBackOffice (3-column daily view)
 *   /portal/lottery?tab=shift-reports→ Lottery.jsx, Shift Reports tab
 *   /portal/lottery?tab=reports      → Lottery.jsx, Reports tab
 *   /portal/lottery?tab=commission   → Lottery.jsx, Commission tab
 *
 * NOTE (April 2026 — Session 44b): `?tab=settings` and `?tab=catalog`
 * tabs were removed.
 *   • Settings (state, commission, sellDirection) → moved to Account →
 *     Store Settings → Lottery section. Old links redirect there.
 *   • Ticket Catalog → superadmin-only at Admin → States. Old links
 *     redirect to ?tab=daily.
 */

import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import LotteryBackOffice from './LotteryBackOffice';
import Lottery from './Lottery';
import LotteryTabBar from '../components/LotteryTabBar';

const VALID_TABS = new Set(['daily', 'shift-reports', 'weekly', 'reports', 'commission']);

export default function LotteryRouter() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tab = searchParams.get('tab') || 'daily';

  // Old deep-links may carry tab=settings or tab=catalog. Redirect them
  // so they don't render a blank page.
  useEffect(() => {
    if (!VALID_TABS.has(tab)) {
      const redirectTarget = (tab === 'settings')
        ? '/portal/account?tab=stores'   // sellDirection lives here now
        : '/portal/lottery?tab=daily';
      navigate(redirectTarget, { replace: true });
    }
  }, [tab, navigate]);

  if (!VALID_TABS.has(tab)) return null;

  return (
    <div className="lottery-router">
      <LotteryTabBar active={tab} />
      {tab === 'daily' ? <LotteryBackOffice /> : <Lottery urlTab={tab} />}
    </div>
  );
}
