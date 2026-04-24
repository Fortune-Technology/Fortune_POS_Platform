import { useState, useEffect, useMemo, ReactNode } from 'react';
import { Search, ArrowUpDown, Loader, PieChart as PieIcon } from 'lucide-react';

import { getAdminOrgAnalytics } from '../services/api';
import { toast } from 'react-toastify';
import '../styles/admin.css';
import './AdminOrgAnalytics.css';

interface OrgRow {
  id: string | number;
  name?: string;
  slug?: string;
  plan?: string;
  isActive?: boolean;
  createdAt?: string;
  transactionCount?: number;
  _count?: { users?: number; stores?: number };
  [key: string]: unknown;
}

type SortField = 'name' | 'plan' | 'users' | 'stores' | 'transactions' | 'isActive' | 'createdAt';
type SortDir = 'asc' | 'desc';

const AdminOrgAnalytics = () => {
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => {
    getAdminOrgAnalytics()
      .then((r: any) => setOrgs((r.data as OrgRow[]) || []))
      .catch(() => toast.error('Failed to load organization analytics'))
      .finally(() => setLoading(false));
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const filtered = useMemo(() => {
    const list = orgs.filter(o =>
      o.name?.toLowerCase().includes(search.toLowerCase()) ||
      o.slug?.toLowerCase().includes(search.toLowerCase())
    );
    list.sort((a, b) => {
      let aVal: string | number | Date, bVal: string | number | Date;
      switch (sortField) {
        case 'users':        aVal = a._count?.users || 0; bVal = b._count?.users || 0; break;
        case 'stores':       aVal = a._count?.stores || 0; bVal = b._count?.stores || 0; break;
        case 'transactions': aVal = a.transactionCount || 0; bVal = b.transactionCount || 0; break;
        case 'createdAt':    aVal = new Date(a.createdAt || 0); bVal = new Date(b.createdAt || 0); break;
        default:
          aVal = ((a[sortField] as string | undefined) || '').toString().toLowerCase();
          bVal = ((b[sortField] as string | undefined) || '').toString().toLowerCase();
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [orgs, search, sortField, sortDir]);

  interface SortHeaderProps {
    field: SortField;
    children: ReactNode;
  }

  const SortHeader = ({ field, children }: SortHeaderProps) => (
    <th className="sortable" onClick={() => handleSort(field)}>
      <span className="aoa-sort-label">
        {children}
        <ArrowUpDown size={12} className={sortField === field ? 'aoa-sort-icon-active' : 'aoa-sort-icon-dim'} />
      </span>
    </th>
  );

  return (
    <>
        <div className="admin-header">
          <div className="admin-header-left">
            <div className="admin-header-icon"><PieIcon size={22} /></div>
            <div>
              <h1>Organization Analytics</h1>
              <p>Performance metrics by organization</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="admin-search">
          <Search size={16} className="admin-search-icon" />
          <input
            type="text"
            placeholder="Search organizations..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="admin-loading">
            <Loader className="animate-spin" size={24} />
          </div>
        ) : (
          <div className="admin-card-wrap">
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <SortHeader field="name">Name</SortHeader>
                    <SortHeader field="plan">Plan</SortHeader>
                    <SortHeader field="users">Users</SortHeader>
                    <SortHeader field="stores">Stores</SortHeader>
                    <SortHeader field="transactions">Transactions</SortHeader>
                    <SortHeader field="isActive">Status</SortHeader>
                    <SortHeader field="createdAt">Joined</SortHeader>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="admin-empty">
                        No organizations found
                      </td>
                    </tr>
                  ) : filtered.map(org => (
                    <tr key={String(org.id)}>
                      <td className="primary">{org.name}</td>
                      <td>
                        <span className={`admin-badge ${org.plan || 'trial'}`}>{org.plan || 'free'}</span>
                      </td>
                      <td>{org._count?.users ?? 0}</td>
                      <td>{org._count?.stores ?? 0}</td>
                      <td>{(org.transactionCount ?? 0).toLocaleString()}</td>
                      <td>
                        <span className={`admin-badge ${org.isActive ? 'active' : 'suspended'}`}>
                          {org.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="muted">
                        {org.createdAt ? new Date(org.createdAt).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
    </>
  );
};

export default AdminOrgAnalytics;
