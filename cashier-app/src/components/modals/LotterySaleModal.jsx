/**
 * LotterySaleModal — light-theme modal for adding lottery sales to the cart.
 * Items are added to the cart (useCartStore.addLotteryItem) so they get
 * tendered together with regular products.
 */

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useCartStore } from '../../stores/useCartStore.js';
import './LotterySaleModal.css';

const NUMPAD = ['7','8','9','4','5','6','1','2','3','.','0','⌫'];
const PRESETS = [1, 2, 3, 5, 10, 20];

export default function LotterySaleModal({ open, games = [], onClose }) {
  const addLotteryItem = useCartStore(s => s.addLotteryItem);
  const [selectedGame, setSelectedGame] = useState(null);
  const [display, setDisplay] = useState('0');
  const [added, setAdded] = useState([]);

  if (!open) return null;

  const handleKey = (key) => {
    setDisplay(prev => {
      if (key === '⌫') return prev.length > 1 ? prev.slice(0, -1) : '0';
      if (key === '.') return prev.includes('.') ? prev : prev + '.';
      if (prev === '0') return key;
      if (prev.includes('.') && prev.split('.')[1].length >= 2) return prev;
      return prev + key;
    });
  };

  const amount = parseFloat(display) || 0;

  const handleAdd = () => {
    if (amount <= 0) return;
    const gameName = selectedGame?.name || 'Lottery';
    addLotteryItem({ lotteryType: 'sale', amount, gameId: selectedGame?.id || null, gameName });
    setAdded(a => [...a, { gameName, amount }]);
    setDisplay('0');
  };

  const handleDone = () => {
    setAdded([]);
    setDisplay('0');
    setSelectedGame(null);
    onClose();
  };

  return (
    <div className="lsam-backdrop">
      <div className="lsam-modal">
        {/* Header */}
        <div className="lsam-header">
          <div className="lsam-header-left">
            <div className="lsam-header-icon">Sale</div>
            <div>
              <div className="lsam-header-title">Lottery Sale</div>
              <div className="lsam-header-sub">Adds to cart - tendered with order</div>
            </div>
          </div>
          <button className="lsam-close-btn" onClick={handleDone}><X size={20} /></button>
        </div>

        <div className="lsam-body">
          {/* Game selector */}
          {games.length > 0 && (
            <div className="lsam-games-section">
              <div className="lsam-section-label">Game (optional)</div>
              <div className="lsam-games">
                {games.map(g => (
                  <button
                    key={g.id}
                    className={`lsam-game-btn${selectedGame?.id === g.id ? ' lsam-game-btn--active' : ''}`}
                    onClick={() => setSelectedGame(selectedGame?.id === g.id ? null : g)}
                  >
                    {g.name}
                    <span className="lsam-game-price">${Number(g.ticketPrice).toFixed(2)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Amount display */}
          <div className="lsam-display">
            <span className="lsam-display-value">${display}</span>
          </div>

          {/* Quick presets */}
          <div className="lsam-presets">
            {PRESETS.map(p => (
              <button key={p} className="lsam-preset-btn" onClick={() => setDisplay(String(p))}>
                ${p}
              </button>
            ))}
          </div>

          {/* Numpad */}
          <div className="lsam-numpad">
            {NUMPAD.map(k => (
              <button
                key={k}
                className={`lsam-numkey${k === '⌫' ? ' lsam-numkey--backspace' : ''}`}
                onClick={() => handleKey(k)}
              >{k}</button>
            ))}
          </div>

          {/* Add to cart button */}
          <button
            className={`lsam-add-btn${amount > 0 ? ' lsam-add-btn--active' : ' lsam-add-btn--disabled'}`}
            onClick={handleAdd}
            disabled={amount <= 0}
          >
            Add {selectedGame ? selectedGame.name : 'Lottery'} — {`$${amount.toFixed(2)}`} to Cart
          </button>

          {/* Added items preview */}
          {added.length > 0 && (
            <div className="lsam-added-list">
              <div className="lsam-added-label">Added to Cart</div>
              {added.map((a, i) => (
                <div key={i} className="lsam-added-row">
                  <span>{a.gameName}</span>
                  <span className="lsam-added-amount">${a.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Done button */}
          {added.length > 0 && (
            <button className="lsam-done-btn" onClick={handleDone}>
              Done — {added.length} item{added.length > 1 ? 's' : ''} in cart
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
