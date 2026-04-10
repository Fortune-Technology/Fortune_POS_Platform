/**
 * LabelDesign.jsx — Shelf label designer with Zebra ZPL integration.
 *
 * Features:
 * - Visual label preview with live variable substitution
 * - Industry-standard label size presets
 * - Configurable fields: Name, Brand, Size, UPC barcode, Price, Sale Price, PLU, Dept, Aisle
 * - ZPL code generation for Zebra label printers
 * - Print single label or batch from product search
 * - Save/load label templates
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Tag, Printer, Save, Plus, Trash2, Eye, Search, Download,
  Type, Barcode, DollarSign, Package, MapPin, Layers, Hash,
  ChevronDown, X, Loader, Settings, Copy, RotateCcw,
} from 'lucide-react';
import { toast } from 'react-toastify';
import Sidebar from '../components/Sidebar';
import api from '../services/api';
import { downloadCSV } from '../utils/exportUtils';
import '../styles/portal.css';

// ═══════════════════════════════════════════════════════════════════════════
// LABEL SIZE PRESETS (industry standard Zebra-compatible)
// ═══════════════════════════════════════════════════════════════════════════

const LABEL_SIZES = [
  { id: '2x1',       name: '2" × 1"',        w: 2,     h: 1,     dpi: 203, desc: 'Small shelf tag' },
  { id: '2x1.25',    name: '2" × 1.25"',     w: 2,     h: 1.25,  dpi: 203, desc: 'Standard shelf tag' },
  { id: '2.25x1.25', name: '2.25" × 1.25"',  w: 2.25,  h: 1.25,  dpi: 203, desc: 'Wide shelf tag' },
  { id: '2.25x0.75', name: '2.25" × 0.75"',  w: 2.25,  h: 0.75,  dpi: 203, desc: 'Slim price tag' },
  { id: '3x1',       name: '3" × 1"',        w: 3,     h: 1,     dpi: 203, desc: 'Large shelf strip' },
  { id: '3x2',       name: '3" × 2"',        w: 3,     h: 2,     dpi: 203, desc: 'Large tag with barcode' },
  { id: '4x2',       name: '4" × 2"',        w: 4,     h: 2,     dpi: 203, desc: 'Full-size shelf tag' },
  { id: '4x3',       name: '4" × 3"',        w: 4,     h: 3,     dpi: 203, desc: 'Jumbo endcap sign' },
  { id: '4x6',       name: '4" × 6"',        w: 4,     h: 6,     dpi: 203, desc: 'Shipping / large sign' },
  { id: '1.5x1',     name: '1.5" × 1"',      w: 1.5,   h: 1,     dpi: 203, desc: 'Jewelry / small item' },
];

// ═══════════════════════════════════════════════════════════════════════════
// AVAILABLE LABEL FIELDS
// ═══════════════════════════════════════════════════════════════════════════

const FIELD_DEFS = [
  { id: 'productName',  label: 'Product Name',    icon: Type,      var: '{{name}}',       example: 'Organic Whole Milk 1 Gal' },
  { id: 'brand',        label: 'Brand',            icon: Tag,       var: '{{brand}}',      example: 'Horizon' },
  { id: 'size',         label: 'Size',             icon: Package,   var: '{{size}}',       example: '128 oz' },
  { id: 'upcBarcode',   label: 'UPC Barcode',      icon: Barcode,   var: '{{upc_barcode}}', example: '0041383096327', type: 'barcode' },
  { id: 'upcText',      label: 'UPC (text only)',   icon: Hash,      var: '{{upc}}',        example: '0041383096327' },
  { id: 'retailPrice',  label: 'Regular Price',    icon: DollarSign, var: '{{price}}',     example: '$4.99' },
  { id: 'salePrice',    label: 'Sale Price',       icon: DollarSign, var: '{{sale_price}}', example: '$3.49' },
  { id: 'plu',          label: 'PLU Code',         icon: Hash,      var: '{{plu}}',        example: '4011' },
  { id: 'department',   label: 'Department',       icon: Layers,    var: '{{department}}', example: 'Dairy' },
  { id: 'aisle',        label: 'Aisle / Location', icon: MapPin,    var: '{{aisle}}',      example: 'Aisle 3, Shelf B' },
];

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_TEMPLATES = [
  {
    id: 'standard-shelf',
    name: 'Standard Shelf Tag',
    labelSize: '2.25x1.25',
    fields: [
      { fieldId: 'productName', x: 5, y: 5,  fontSize: 'medium', bold: true },
      { fieldId: 'brand',       x: 5, y: 25, fontSize: 'small',  bold: false },
      { fieldId: 'size',        x: 5, y: 40, fontSize: 'small',  bold: false },
      { fieldId: 'retailPrice', x: 5, y: 58, fontSize: 'xlarge', bold: true },
      { fieldId: 'upcBarcode',  x: 120, y: 45, fontSize: 'small', bold: false },
    ],
  },
  {
    id: 'price-only',
    name: 'Price Tag (Compact)',
    labelSize: '2x1',
    fields: [
      { fieldId: 'productName', x: 5, y: 5,  fontSize: 'medium', bold: true },
      { fieldId: 'retailPrice', x: 5, y: 28, fontSize: 'xlarge', bold: true },
      { fieldId: 'upcText',     x: 5, y: 55, fontSize: 'tiny',   bold: false },
    ],
  },
  {
    id: 'sale-tag',
    name: 'Sale Price Tag',
    labelSize: '3x2',
    fields: [
      { fieldId: 'productName', x: 5, y: 5,  fontSize: 'large',  bold: true },
      { fieldId: 'brand',       x: 5, y: 28, fontSize: 'small',  bold: false },
      { fieldId: 'retailPrice', x: 5, y: 50, fontSize: 'medium', bold: false },
      { fieldId: 'salePrice',   x: 5, y: 70, fontSize: 'xlarge', bold: true },
      { fieldId: 'upcBarcode',  x: 180, y: 50, fontSize: 'small', bold: false },
    ],
  },
  {
    id: 'barcode-tag',
    name: 'Barcode Label',
    labelSize: '2x1',
    fields: [
      { fieldId: 'productName', x: 5, y: 3,  fontSize: 'small', bold: true },
      { fieldId: 'upcBarcode',  x: 20, y: 18, fontSize: 'small', bold: false },
      { fieldId: 'retailPrice', x: 5, y: 55, fontSize: 'large',  bold: true },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// ZPL GENERATION
// ═══════════════════════════════════════════════════════════════════════════

const FONT_SIZES = {
  tiny:   { zplFont: 'A', h: 15, w: 10 },
  small:  { zplFont: '0', h: 20, w: 14 },
  medium: { zplFont: '0', h: 28, w: 18 },
  large:  { zplFont: '0', h: 40, w: 26 },
  xlarge: { zplFont: '0', h: 56, w: 36 },
};

function generateZPL(template, productData, labelSize) {
  const size = LABEL_SIZES.find(s => s.id === (template.labelSize || labelSize)) || LABEL_SIZES[1];
  const dpi = size.dpi;
  const widthDots = Math.round(size.w * dpi);
  const heightDots = Math.round(size.h * dpi);

  let zpl = `^XA\n`;
  zpl += `^PW${widthDots}\n`;      // print width
  zpl += `^LL${heightDots}\n`;     // label length
  zpl += `^LH0,0\n`;              // label home

  for (const field of (template.fields || [])) {
    const def = FIELD_DEFS.find(f => f.id === field.fieldId);
    if (!def) continue;

    const xDots = Math.round((field.x || 0) * (dpi / 72));  // convert from 72dpi design space
    const yDots = Math.round((field.y || 0) * (dpi / 72));
    const fs = FONT_SIZES[field.fontSize || 'medium'];
    const value = resolveVariable(def, productData);

    if (def.type === 'barcode' && productData.upc) {
      // UPC-A barcode
      zpl += `^FO${xDots},${yDots}\n`;
      zpl += `^BY2,2,50\n`;
      zpl += `^BC,,Y,N,N\n`;
      zpl += `^FD${productData.upc}^FS\n`;
    } else {
      // Text field
      const weight = field.bold ? 'B' : 'N';
      zpl += `^FO${xDots},${yDots}\n`;
      zpl += `^A${fs.zplFont},${fs.h},${fs.w}\n`;
      if (field.bold) zpl += `^FB${widthDots - xDots},1,0,L\n`;
      zpl += `^FD${value}^FS\n`;
    }
  }

  zpl += `^XZ\n`;
  return zpl;
}

function resolveVariable(fieldDef, data) {
  switch (fieldDef.id) {
    case 'productName': return (data.name || 'Product Name').substring(0, 40);
    case 'brand':       return data.brand || '';
    case 'size':        return `${data.size || ''} ${data.sizeUnit || ''}`.trim();
    case 'upcBarcode':  return data.upc || '';
    case 'upcText':     return data.upc || '';
    case 'retailPrice': return `$${Number(data.retailPrice || 0).toFixed(2)}`;
    case 'salePrice':   return data.salePrice ? `SALE $${Number(data.salePrice).toFixed(2)}` : '';
    case 'plu':         return data.plu || '';
    case 'department':  return data.departmentName || data.department || '';
    case 'aisle':       return data.aisle || data.shelfLocation || '';
    default:            return '';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PREVIEW RENDER (CSS visual approximation of label)
// ═══════════════════════════════════════════════════════════════════════════

const PREVIEW_FONT_SIZES = { tiny: 8, small: 10, medium: 13, large: 18, xlarge: 26 };

function LabelPreview({ template, sampleData, labelSize }) {
  const size = LABEL_SIZES.find(s => s.id === (template?.labelSize || labelSize)) || LABEL_SIZES[1];
  const scale = 3; // 1 inch = 3rem on screen

  return (
    <div style={{
      width: `${size.w * scale}rem`, height: `${size.h * scale}rem`,
      border: '2px solid var(--border-color)', borderRadius: 4,
      background: '#fff', position: 'relative', overflow: 'hidden',
      boxShadow: 'var(--shadow-md)', flexShrink: 0,
    }}>
      {(template?.fields || []).map((field, i) => {
        const def = FIELD_DEFS.find(f => f.id === field.fieldId);
        if (!def) return null;
        const value = resolveVariable(def, sampleData);
        const fs = PREVIEW_FONT_SIZES[field.fontSize || 'medium'];

        if (def.type === 'barcode') {
          return (
            <div key={i} style={{
              position: 'absolute',
              left: `${(field.x / 72) * scale}rem`,
              top: `${(field.y / 72) * scale}rem`,
              display: 'flex', flexDirection: 'column', alignItems: 'center',
            }}>
              <div style={{ display: 'flex', gap: 1, height: 30 }}>
                {(value || '012345678901').split('').map((c, j) => (
                  <div key={j} style={{
                    width: j % 2 === 0 ? 2 : 1,
                    background: j % 3 === 0 ? '#000' : 'transparent',
                    height: '100%',
                  }} />
                ))}
              </div>
              <span style={{ fontSize: 7, fontFamily: 'monospace', color: '#333', marginTop: 2 }}>{value}</span>
            </div>
          );
        }

        return (
          <div key={i} style={{
            position: 'absolute',
            left: `${(field.x / 72) * scale}rem`,
            top: `${(field.y / 72) * scale}rem`,
            fontSize: fs,
            fontWeight: field.bold ? 800 : 400,
            color: field.fieldId === 'salePrice' ? '#dc2626' : '#000',
            fontFamily: "'Inter', sans-serif",
            lineHeight: 1.2,
            maxWidth: `${(size.w * scale) - (field.x / 72 * scale)}rem`,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            textDecoration: field.fieldId === 'retailPrice' && sampleData.salePrice ? 'line-through' : 'none',
          }}>
            {value || def.example}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function LabelDesign({ embedded }) {
  // ── Template state ──────────────────────────────────────────────────
  const [templates, setTemplates] = useState(() => {
    const saved = localStorage.getItem('storv_label_templates');
    return saved ? JSON.parse(saved) : DEFAULT_TEMPLATES;
  });
  const [activeTemplateId, setActiveTemplateId] = useState(templates[0]?.id || 'standard-shelf');
  const [editingTemplate, setEditingTemplate] = useState(null); // cloned copy being edited

  // ── Product search + batch print ───────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [searching, setSearching] = useState(false);
  const [printQty, setPrintQty] = useState(1);
  const [showZPL, setShowZPL] = useState(false);
  const [generatedZPL, setGeneratedZPL] = useState('');

  const searchTimer = useRef(null);

  const activeTemplate = editingTemplate || templates.find(t => t.id === activeTemplateId) || templates[0];
  const activeLabelSize = LABEL_SIZES.find(s => s.id === activeTemplate?.labelSize) || LABEL_SIZES[1];

  const sampleProduct = selectedProducts[0] || {
    name: 'Organic Whole Milk', brand: 'Horizon', size: '128', sizeUnit: 'oz',
    upc: '0041383096327', retailPrice: 4.99, salePrice: null, plu: '',
    departmentName: 'Dairy', aisle: 'Aisle 3',
  };

  // ── Save templates to localStorage ─────────────────────────────────
  useEffect(() => {
    localStorage.setItem('storv_label_templates', JSON.stringify(templates));
  }, [templates]);

  // ── Product search ─────────────────────────────────────────────────
  const handleSearch = useCallback(async (q) => {
    if (!q || q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const r = await api.get('/catalog/products', { params: { search: q, limit: 20, includeStore: true } });
      setSearchResults(r.data?.products || r.data || []);
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  }, []);

  const onSearchChange = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => handleSearch(q), 300);
  };

  const addProduct = (p) => {
    if (selectedProducts.find(sp => sp.id === p.id)) return;
    setSelectedProducts(prev => [...prev, {
      id: p.id, name: p.name, brand: p.brand, size: p.size, sizeUnit: p.sizeUnit,
      upc: p.upc, plu: p.plu, retailPrice: p.defaultRetailPrice || p.retailPrice,
      salePrice: p.salePrice || null,
      departmentName: p.department?.name || '', aisle: p.aisle || p.shelfLocation || '',
    }]);
    setSearchQuery('');
    setSearchResults([]);
  };

  // ── Template editing ───────────────────────────────────────────────
  const startEdit = () => setEditingTemplate(JSON.parse(JSON.stringify(activeTemplate)));

  const saveEdit = () => {
    if (!editingTemplate) return;
    setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? editingTemplate : t));
    setEditingTemplate(null);
    toast.success('Template saved');
  };

  const cancelEdit = () => setEditingTemplate(null);

  const addFieldToTemplate = (fieldId) => {
    if (!editingTemplate) return;
    const existing = editingTemplate.fields.find(f => f.fieldId === fieldId);
    if (existing && fieldId !== 'upcBarcode') return; // allow only one of each except barcode
    const lastY = editingTemplate.fields.length > 0
      ? Math.max(...editingTemplate.fields.map(f => f.y)) + 18
      : 5;
    setEditingTemplate({
      ...editingTemplate,
      fields: [...editingTemplate.fields, { fieldId, x: 5, y: lastY, fontSize: 'medium', bold: false }],
    });
  };

  const updateField = (idx, key, val) => {
    if (!editingTemplate) return;
    const fields = [...editingTemplate.fields];
    fields[idx] = { ...fields[idx], [key]: val };
    setEditingTemplate({ ...editingTemplate, fields });
  };

  const removeField = (idx) => {
    if (!editingTemplate) return;
    setEditingTemplate({ ...editingTemplate, fields: editingTemplate.fields.filter((_, i) => i !== idx) });
  };

  const createNewTemplate = () => {
    const id = `custom-${Date.now()}`;
    const newTpl = { id, name: 'New Template', labelSize: '2.25x1.25', fields: [] };
    setTemplates(prev => [...prev, newTpl]);
    setActiveTemplateId(id);
    setEditingTemplate(JSON.parse(JSON.stringify(newTpl)));
  };

  const deleteTemplate = (id) => {
    if (templates.length <= 1) { toast.error('Cannot delete the last template'); return; }
    setTemplates(prev => prev.filter(t => t.id !== id));
    if (activeTemplateId === id) setActiveTemplateId(templates[0]?.id);
    toast.success('Template deleted');
  };

  // ── ZPL Generation + Print ─────────────────────────────────────────
  const generateAllZPL = () => {
    const products = selectedProducts.length > 0 ? selectedProducts : [sampleProduct];
    let allZPL = '';
    for (const p of products) {
      for (let i = 0; i < printQty; i++) {
        allZPL += generateZPL(activeTemplate, p, activeTemplate.labelSize);
      }
    }
    setGeneratedZPL(allZPL);
    setShowZPL(true);
    return allZPL;
  };

  const handlePrint = async () => {
    const zpl = generateAllZPL();
    // Try Electron label printer first
    if (window.electronAPI?.printLabelNetwork) {
      // Would need hardware config — for now, copy to clipboard
    }
    try {
      await navigator.clipboard.writeText(zpl);
      toast.success(`ZPL copied to clipboard (${selectedProducts.length || 1} labels × ${printQty})`);
    } catch {
      toast.info('ZPL generated — see preview below');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────
  const content = (
    <div className="p-page" style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div className="p-header">
        <div className="p-header-left">
          <div className="p-header-icon"><Tag size={22} /></div>
          <div>
            <h1 className="p-title">Label Design</h1>
            <p className="p-subtitle">Design shelf tags and print to Zebra label printers via ZPL</p>
          </div>
        </div>
        <div className="p-header-actions">
          <button className="p-btn p-btn-ghost p-btn-sm" onClick={createNewTemplate}><Plus size={13} /> New Template</button>
          {editingTemplate
            ? <>
                <button className="p-btn p-btn-primary p-btn-sm" onClick={saveEdit}><Save size={13} /> Save</button>
                <button className="p-btn p-btn-ghost p-btn-sm" onClick={cancelEdit}><X size={13} /> Cancel</button>
              </>
            : <button className="p-btn p-btn-secondary p-btn-sm" onClick={startEdit}><Settings size={13} /> Edit Template</button>
          }
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.25rem' }}>
        {/* ── Left: Template list + Field palette ────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Template selector */}
          <div className="p-card">
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Templates</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {templates.map(t => (
                <div key={t.id}
                  onClick={() => { setActiveTemplateId(t.id); setEditingTemplate(null); }}
                  style={{
                    padding: '0.5rem 0.65rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                    background: activeTemplateId === t.id ? 'var(--brand-10)' : 'transparent',
                    border: `1px solid ${activeTemplateId === t.id ? 'var(--border-brand)' : 'transparent'}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      {LABEL_SIZES.find(s => s.id === t.labelSize)?.name || t.labelSize} — {t.fields?.length || 0} fields
                    </div>
                  </div>
                  {templates.length > 1 && (
                    <button onClick={(e) => { e.stopPropagation(); deleteTemplate(t.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Label size selector (only when editing) */}
          {editingTemplate && (
            <div className="p-card">
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Label Size</div>
              <select className="p-select" value={editingTemplate.labelSize}
                onChange={e => setEditingTemplate({ ...editingTemplate, labelSize: e.target.value })}>
                {LABEL_SIZES.map(s => (
                  <option key={s.id} value={s.id}>{s.name} — {s.desc}</option>
                ))}
              </select>

              <div style={{ marginTop: 10 }}>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Template Name</label>
                <input className="p-input" style={{ marginTop: 4 }} value={editingTemplate.name}
                  onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })} />
              </div>
            </div>
          )}

          {/* Field palette (only when editing) */}
          {editingTemplate && (
            <div className="p-card">
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Add Field</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {FIELD_DEFS.map(f => {
                  const Icon = f.icon;
                  const added = editingTemplate.fields.some(ef => ef.fieldId === f.id);
                  return (
                    <button key={f.id} onClick={() => addFieldToTemplate(f.id)}
                      disabled={added && f.id !== 'upcBarcode'}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '0.4rem 0.6rem',
                        borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
                        background: added ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                        color: added ? 'var(--text-muted)' : 'var(--text-primary)',
                        cursor: added ? 'default' : 'pointer', fontSize: '0.78rem', fontWeight: 500,
                        opacity: added ? 0.5 : 1, textAlign: 'left',
                      }}>
                      <Icon size={13} /> {f.label}
                      {added && <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--success)' }}>Added</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Preview + Field config + Print ──────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Preview */}
          <div className="p-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Label Preview — {activeLabelSize.name}
              </div>
              <span className="p-badge p-badge-brand">{activeTemplate.fields?.length || 0} fields</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
              <LabelPreview template={activeTemplate} sampleData={sampleProduct} labelSize={activeTemplate.labelSize} />
            </div>
          </div>

          {/* Field configuration (editing mode) */}
          {editingTemplate && editingTemplate.fields.length > 0 && (
            <div className="p-card">
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Field Properties</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {editingTemplate.fields.map((field, idx) => {
                  const def = FIELD_DEFS.find(f => f.id === field.fieldId);
                  if (!def) return null;
                  const Icon = def.icon;
                  return (
                    <div key={idx} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 0.65rem',
                      border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-secondary)', fontSize: '0.8rem',
                    }}>
                      <Icon size={13} color="var(--accent-primary)" />
                      <span style={{ fontWeight: 600, minWidth: 90 }}>{def.label}</span>
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>X</label>
                      <input type="number" value={field.x} onChange={e => updateField(idx, 'x', Number(e.target.value))}
                        style={{ width: 50, padding: '3px 6px', borderRadius: 4, border: '1px solid var(--border-color)', fontSize: '0.78rem', textAlign: 'center' }} />
                      <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Y</label>
                      <input type="number" value={field.y} onChange={e => updateField(idx, 'y', Number(e.target.value))}
                        style={{ width: 50, padding: '3px 6px', borderRadius: 4, border: '1px solid var(--border-color)', fontSize: '0.78rem', textAlign: 'center' }} />
                      <select value={field.fontSize || 'medium'} onChange={e => updateField(idx, 'fontSize', e.target.value)}
                        style={{ padding: '3px 6px', borderRadius: 4, border: '1px solid var(--border-color)', fontSize: '0.75rem' }}>
                        {Object.keys(FONT_SIZES).map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', fontSize: '0.72rem' }}>
                        <input type="checkbox" checked={field.bold} onChange={e => updateField(idx, 'bold', e.target.checked)}
                          style={{ width: 14, height: 14, accentColor: 'var(--accent-primary)' }} /> B
                      </label>
                      <button onClick={() => removeField(idx)}
                        style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', padding: 2 }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Product search + print */}
          <div className="p-card">
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Print Labels</div>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
              <input className="p-input" placeholder="Search products by name, UPC, or brand..."
                value={searchQuery} onChange={onSearchChange}
                style={{ paddingLeft: 32 }} />
              {searching && <Loader size={14} className="p-spin" style={{ position: 'absolute', right: 10, top: 10 }} />}
            </div>

            {/* Search results dropdown */}
            {searchResults.length > 0 && (
              <div style={{
                border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-secondary)', maxHeight: 200, overflowY: 'auto', marginBottom: 10,
              }}>
                {searchResults.map(p => (
                  <div key={p.id} onClick={() => addProduct(p)} style={{
                    padding: '0.45rem 0.75rem', cursor: 'pointer', borderBottom: '1px solid var(--border-light)',
                    display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem',
                  }}>
                    <span><strong>{p.name}</strong> <span style={{ color: 'var(--text-muted)' }}>({p.upc})</span></span>
                    <span style={{ fontWeight: 700 }}>${Number(p.defaultRetailPrice || p.retailPrice || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Selected products */}
            {selectedProducts.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>
                  Selected Products ({selectedProducts.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {selectedProducts.map(p => (
                    <span key={p.id} className="p-badge p-badge-brand" style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px' }}>
                      {p.name}
                      <X size={10} style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedProducts(prev => prev.filter(sp => sp.id !== p.id))} />
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Print controls */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Qty per product:</label>
              <input type="number" min="1" max="100" value={printQty}
                onChange={e => setPrintQty(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: 60, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: '0.82rem', textAlign: 'center' }} />
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button className="p-btn p-btn-ghost p-btn-sm" onClick={generateAllZPL}><Eye size={13} /> Preview ZPL</button>
                <button className="p-btn p-btn-primary p-btn-sm" onClick={handlePrint}>
                  <Printer size={13} /> Print Labels ({(selectedProducts.length || 1) * printQty})
                </button>
              </div>
            </div>
          </div>

          {/* ZPL preview */}
          {showZPL && (
            <div className="p-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Generated ZPL Code</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="p-btn p-btn-ghost p-btn-sm" onClick={() => { navigator.clipboard.writeText(generatedZPL); toast.success('ZPL copied'); }}>
                    <Copy size={12} /> Copy
                  </button>
                  <button className="p-btn p-btn-ghost p-btn-sm" onClick={() => setShowZPL(false)}><X size={12} /></button>
                </div>
              </div>
              <pre style={{
                background: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)',
                fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--text-secondary)',
                maxHeight: 200, overflowY: 'auto', whiteSpace: 'pre-wrap', margin: 0,
              }}>
                {generatedZPL}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (embedded) return <div className="p-tab-content">{content}</div>;

  return (
    <div className="layout-container">
      <Sidebar />
      <main className="main-content">{content}</main>
    </div>
  );
}
