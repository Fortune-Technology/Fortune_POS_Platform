/**
 * QuickButtonRenderer
 *
 * Read-only renderer of the WYSIWYG tile grid built in the portal. Tiles
 * are placed at explicit (x,y) positions with (w,h) sizes — the grid
 * template is computed from the tallest/widthiest occupied cell, keeping
 * layout pixel-perfect from what the admin saw in the builder.
 *
 * Tap behaviour per tile type:
 *  - product → addProduct to cart (with all metadata)
 *  - folder  → drill into children view (this component recurses one level)
 *  - action  → onAction(actionKey) — POSScreen wires the handler map
 *  - text    → no-op (display only)
 *  - image   → if targetProductId/targetActionKey set, fire it; else no-op
 *
 * Folder depth is 1 — backend enforces this — so no recursion needed
 * beyond a single drill-in.
 */
import React, { useState, useMemo } from 'react';
import { ArrowLeft, Zap, Folder, Package, Image as ImageIcon, Tag,
  DollarSign, Ban, RefreshCcw, Lock, Printer, UserSearch, Clock, Receipt,
  Ticket, Fuel, Recycle, Edit3 } from 'lucide-react';
import { useCartStore } from '../../stores/useCartStore.js';
import './QuickButtonRenderer.css';

const ACTION_ICONS = {
  discount:           DollarSign,
  void:               Ban,
  refund:             RefreshCcw,
  open_drawer:        Lock,
  no_sale:            Lock,
  print_last_receipt: Printer,
  customer_lookup:    UserSearch,
  customer_add:       UserSearch,
  price_check:        Tag,
  hold:               Clock,
  recall:             Clock,
  cash_drop:          Receipt,
  payout:             Receipt,
  end_of_day:         Receipt,
  lottery_sale:       Ticket,
  fuel_sale:          Fuel,
  bottle_return:      Recycle,
  manual_entry:       Edit3,
  clock_event:        Clock,
};

export default function QuickButtonRenderer({ layout, onAction }) {
  const [folderId, setFolderId] = useState(null);
  const addProduct = useCartStore(s => s.addProduct);

  const tree = Array.isArray(layout?.tree) ? layout.tree : [];
  const gridCols = layout?.gridCols || 6;
  // Honor the per-store tile-height set in the builder. Default 56px
  // matches the builder default — tight but comfortably above POS
  // touch-target minimums (44pt iOS / 48dp Android).
  const rowHeight = layout?.rowHeight || 56;

  // Tiles to render: root or the active folder's children
  const currentFolder = folderId ? tree.find(t => t.id === folderId) : null;
  const tilesToRender = currentFolder ? (currentFolder.children || []) : tree;

  const gridRows = useMemo(() => {
    // Enough rows to fit the tallest tile
    let max = 0;
    tilesToRender.forEach(t => { max = Math.max(max, (t.y || 0) + (t.h || 1)); });
    return Math.max(max, 1);
  }, [tilesToRender]);

  const handleTap = (tile) => {
    if (tile.type === 'product') {
      addProduct({
        id:          tile.productId,
        productId:   tile.productId,
        name:        tile.productName,
        retailPrice: Number(tile.price || 0),
        defaultRetailPrice: Number(tile.price || 0),
        upc:         tile.upc,
      });
      return;
    }
    if (tile.type === 'folder') {
      setFolderId(tile.id);
      return;
    }
    if (tile.type === 'action') {
      onAction?.(tile.actionKey, tile);
      return;
    }
    if (tile.type === 'image') {
      if (tile.targetProductId) {
        addProduct({
          id:          tile.targetProductId,
          productId:   tile.targetProductId,
          name:        tile.label || 'Product',
          retailPrice: Number(tile.price || 0),
        });
      } else if (tile.targetActionKey) {
        onAction?.(tile.targetActionKey, tile);
      }
    }
  };

  if (tilesToRender.length === 0) {
    return (
      <div className="qbr-empty">
        {currentFolder
          ? 'This folder is empty.'
          : 'No quick buttons configured — ask the store admin to set up the home screen in the portal.'}
        {currentFolder && (
          <button className="qbr-back" onClick={() => setFolderId(null)}>
            <ArrowLeft size={13} /> Back
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="qbr-wrap">
      {currentFolder && (
        <div className="qbr-breadcrumb">
          <button className="qbr-back" onClick={() => setFolderId(null)}>
            <ArrowLeft size={14} /> Back
          </button>
          <span className="qbr-folder-label">{currentFolder.emoji || '📁'} {currentFolder.label || 'Folder'}</span>
        </div>
      )}
      <div
        className="qbr-grid"
        style={{
          gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${gridRows}, ${rowHeight}px)`,
          // Proportional gap — matches the builder's derivation so the
          // cashier sees the exact spacing the admin designed with.
          gap: `${Math.max(6, Math.min(18, Math.round(rowHeight / 8)))}px`,
        }}
      >
        {tilesToRender.map(tile => (
          <Tile
            key={tile.id}
            tile={tile}
            onTap={() => handleTap(tile)}
          />
        ))}
      </div>
    </div>
  );
}

function Tile({ tile, onTap }) {
  const style = {
    gridColumn: `${(tile.x || 0) + 1} / span ${tile.w || 1}`,
    gridRow:    `${(tile.y || 0) + 1} / span ${tile.h || 1}`,
    backgroundColor: tile.backgroundColor || undefined,
    color:           tile.textColor       || undefined,
    backgroundImage: tile.imageUrl ? `url(${tile.imageUrl})` : undefined,
  };

  const isText = tile.type === 'text';

  return (
    <button
      className={`qbr-tile qbr-tile--${tile.type}`}
      style={style}
      onClick={onTap}
      disabled={isText}
    >
      <TileBody tile={tile} />
    </button>
  );
}

function TileBody({ tile }) {
  if (tile.type === 'product') {
    return (
      <div className="qbr-tile-body">
        <Package size={14} className="qbr-tile-icon" />
        <div className="qbr-tile-label">{tile.productName || 'Product'}</div>
        {tile.price != null && (
          <div className="qbr-tile-sub">${Number(tile.price).toFixed(2)}</div>
        )}
      </div>
    );
  }
  if (tile.type === 'folder') {
    return (
      <div className="qbr-tile-body">
        <div className="qbr-tile-emoji">{tile.emoji || '📁'}</div>
        <div className="qbr-tile-label">{tile.label || 'Folder'}</div>
      </div>
    );
  }
  if (tile.type === 'action') {
    const Icon = ACTION_ICONS[tile.actionKey] || Zap;
    return (
      <div className="qbr-tile-body">
        <Icon size={16} className="qbr-tile-icon" />
        <div className="qbr-tile-label">{tile.label || tile.actionKey}</div>
      </div>
    );
  }
  if (tile.type === 'text') {
    return (
      <div className="qbr-tile-body qbr-tile-body--text">
        <div className="qbr-tile-text">{tile.label}</div>
      </div>
    );
  }
  if (tile.type === 'image') {
    return (
      <div className="qbr-tile-body qbr-tile-body--image">
        {tile.label && <div className="qbr-tile-image-label">{tile.label}</div>}
      </div>
    );
  }
  return null;
}
