import React, { useState } from 'react';
import { ShieldAlert, CheckCircle, XCircle, CreditCard, Calendar, ShieldOff } from 'lucide-react';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner.js';
import { parseAAMVALicense, meetsAgeRequirement, looksLikeLicense } from '../../utils/pdf417Parser.js';
import { useCartStore } from '../../stores/useCartStore.js';
import { useManagerStore } from '../../stores/useManagerStore.js';
import './AgeVerificationModal.css';

export default function AgeVerificationModal() {
  const { pendingProduct, confirmAgeVerify, cancelAgeVerify } = useCartStore();
  const requireManager = useManagerStore(s => s.requireManager);
  const required = pendingProduct?.ageRequired || 21;

  const [result,    setResult]    = useState(null);
  const [resultMsg, setResultMsg] = useState('');
  const [manualDOB, setManualDOB] = useState('');
  const [showManual,setShowManual]= useState(false);

  useBarcodeScanner((raw) => {
    if (!looksLikeLicense(raw)) return;
    try {
      const parsed = parseAAMVALicense(raw);
      if (meetsAgeRequirement(parsed.dob, required)) {
        setResult('pass');
        setResultMsg(`Age verified — ${parsed.age} years old`);
        setTimeout(confirmAgeVerify, 1200);
      } else {
        setResult('fail');
        setResultMsg(`ID shows age ${parsed.age} — must be ${required}+`);
      }
    } catch (e) {
      setResult('fail');
      setResultMsg('Could not read ID — try manual entry');
      setShowManual(true);
    }
  }, true);

  const checkManual = () => {
    const s = manualDOB.replace(/\D/g, '');
    if (s.length !== 8) { setResultMsg('Enter date as MM/DD/YYYY'); return; }
    const mm = s.slice(0, 2), dd = s.slice(2, 4), yyyy = s.slice(4, 8);
    const dob = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    if (isNaN(dob)) { setResultMsg('Invalid date'); return; }
    const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000));
    if (age >= required) {
      setResult('pass');
      setResultMsg(`Age verified — ${age} years old`);
      setTimeout(confirmAgeVerify, 1200);
    } else {
      setResult('fail');
      setResultMsg(`Customer is ${age} years old — must be ${required}+`);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-box" style={{ maxWidth: 440 }}>
        {/* Header */}
        <div className="avm-header">
          <div className="avm-header-icon">
            <ShieldAlert size={24} color="var(--amber)" />
          </div>
          <div>
            <div className="avm-header-title">Age Verification Required</div>
            <div className="avm-header-sub">
              {pendingProduct?.name} - Must be {required}+
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="avm-body">
          {/* Scan prompt */}
          {!showManual && result !== 'pass' && (
            <div className="avm-scan-prompt">
              <CreditCard size={40} color="var(--amber)" className="avm-scan-icon" />
              <div className="avm-scan-title">Scan customer's ID</div>
              <div className="avm-scan-desc">
                Use the 2D scanner to scan the barcode on the back of the driver's license
              </div>
            </div>
          )}

          {/* Result banner */}
          {result && (
            <div className={`avm-result${result === 'pass' ? ' avm-result--pass' : ' avm-result--fail'}`}>
              {result === 'pass'
                ? <CheckCircle size={20} color="var(--green)" />
                : <XCircle    size={20} color="var(--red)" />}
              <span className={`avm-result-text${result === 'pass' ? ' avm-result-text--pass' : ' avm-result-text--fail'}`}>{resultMsg}</span>
            </div>
          )}

          {/* Manual DOB fallback */}
          {showManual && result !== 'pass' && (
            <div className="avm-manual">
              <label className="avm-manual-label">
                <Calendar size={12} />
                Enter date of birth (MM/DD/YYYY)
              </label>
              <div className="avm-manual-row">
                <input
                  className="avm-manual-input"
                  value={manualDOB}
                  onChange={e => setManualDOB(e.target.value)}
                  placeholder="01/15/1990"
                  autoFocus
                />
                <button className="avm-verify-btn" onClick={checkManual}>Verify</button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="avm-footer">
          {!showManual && result !== 'pass' && (
            <button className="avm-btn avm-btn-manual" onClick={() => setShowManual(true)}>
              Manual Entry
            </button>
          )}
          {result !== 'pass' && (
            <button
              className="avm-btn avm-btn-override"
              onClick={() => requireManager('Age Verification Override', () => { confirmAgeVerify(); })}
            >
              <ShieldOff size={14} />
              Manager Override
            </button>
          )}
          <button className="avm-btn avm-btn-decline" onClick={cancelAgeVerify}>
            Decline Item
          </button>
        </div>
      </div>
    </div>
  );
}
