import React, { useEffect, useState } from 'react';
import { X, Save, Loader, Shield } from 'lucide-react';
import { toast } from 'react-toastify';
import { listRoles, getUserRolesApi, setUserRolesApi } from '../services/api';
import './UserRolesModal.css';

/**
 * Per-user role assignment modal.
 *
 * Props:
 *   user      — { id, name, email, role (legacy primary role) }
 *   onClose() — called when user closes / saves
 */
export default function UserRolesModal({ user, onClose }) {
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [roles, setRoles]       = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());

  useEffect(() => {
    (async () => {
      try {
        const [rolesRes, userRolesRes] = await Promise.all([
          listRoles({ includeSystem: true }),
          getUserRolesApi(user.id),
        ]);
        // Only show org-scope, active roles that org admins can actually assign
        const assignable = (rolesRes.roles || []).filter(r =>
          r.scope === 'org' && r.status === 'active'
        );
        setRoles(assignable);
        setSelectedIds(new Set((userRolesRes.roles || []).map(r => r.id)));
      } catch (err) {
        toast.error(err?.response?.data?.error || 'Failed to load roles');
      } finally {
        setLoading(false);
      }
    })();
  }, [user.id]);

  const toggle = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setUserRolesApi(user.id, [...selectedIds]);
      toast.success('Roles updated');
      onClose?.(true);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="urm-overlay" onClick={() => !saving && onClose?.(false)}>
      <div className="urm-modal" onClick={e => e.stopPropagation()}>
        <div className="urm-head">
          <div className="urm-title">
            <Shield size={18} />
            <div>
              <h3>Manage Roles</h3>
              <p>{user.name || user.email}</p>
            </div>
          </div>
          <button onClick={() => onClose?.(false)}><X size={18} /></button>
        </div>
        <div className="urm-body">
          <p className="urm-hint">
            Assign one or more roles to this user. Permissions from all assigned roles
            are combined. The user's primary role (<code>{user.role}</code>) also grants
            its default permissions automatically.
          </p>
          {loading ? (
            <div className="urm-loading"><Loader size={20} className="spin" /> Loading…</div>
          ) : roles.length === 0 ? (
            <div className="urm-empty">No assignable roles found. Create roles under <b>Roles & Permissions</b>.</div>
          ) : (
            <div className="urm-list">
              {roles.map(r => {
                const on = selectedIds.has(r.id);
                return (
                  <label key={r.id} className={`urm-row ${on ? 'on' : ''}`}>
                    <input type="checkbox" checked={on} onChange={() => toggle(r.id)} />
                    <div className="urm-row-body">
                      <div className="urm-row-head">
                        <strong>{r.name}</strong>
                        {r.isSystem && <span className="urm-sys">System</span>}
                      </div>
                      {r.description && <p>{r.description}</p>}
                      <span className="urm-count">{r.permissions.length} permissions</span>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
        <div className="urm-foot">
          <button className="p-btn p-btn-secondary" onClick={() => onClose?.(false)} disabled={saving}>Cancel</button>
          <button className="p-btn p-btn-primary" onClick={handleSave} disabled={saving || loading}>
            {saving ? <Loader size={14} className="spin" /> : <Save size={14} />} Save
          </button>
        </div>
      </div>
    </div>
  );
}
