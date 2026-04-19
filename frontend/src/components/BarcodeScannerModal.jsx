/**
 * BarcodeScannerModal
 *
 * Camera-based UPC/EAN/Code-128 scanner for tablets and phones. No handheld
 * scanner hardware required. Supported cases:
 *   - Product search / add (portal ProductCatalog)
 *   - Customer lookup by loyalty card (portal Customers)
 *   - Cashier-app scan input when no handheld scanner is connected
 *
 * Detection strategy:
 *   1. Native `BarcodeDetector` API (Chromium-based browsers — Android
 *      Chrome, Chromium Edge, Chrome desktop). Zero dependencies.
 *   2. Fallback to `@zxing/browser` lazy-loaded from esm.sh CDN on first
 *      call. Covers iOS Safari and older browsers.
 *
 * The parent component renders this modal with `onDetected(value)`; the
 * modal handles camera start/stop, permissions, scanning loop, cleanup.
 * Calls `onDetected` exactly once per scan, then closes automatically
 * (so the parent can immediately resolve the product / customer lookup).
 *
 * The component plays a short success beep on detection via the Web Audio
 * API so the user knows the scan registered even if they look away.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Camera, AlertCircle, RefreshCcw, ZapOff, Zap } from 'lucide-react';
import './BarcodeScannerModal.css';

const SUPPORTED_FORMATS = [
  'code_128', 'code_39', 'code_93',
  'ean_13', 'ean_8',
  'upc_a', 'upc_e',
  'qr_code', 'pdf417',
  'data_matrix', 'itf',
];

function playBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.22);
    setTimeout(() => ctx.close(), 300);
  } catch { /* non-critical */ }
}

export default function BarcodeScannerModal({ open, onClose, onDetected, title = 'Scan Barcode' }) {
  const videoRef   = useRef(null);
  const streamRef  = useRef(null);
  const detectorRef = useRef(null);
  const zxingReaderRef = useRef(null);
  const tickingRef = useRef(false);
  const lastResultRef = useRef(null);
  const rafRef = useRef(null);

  const [status,     setStatus]     = useState('idle');   // 'idle' | 'starting' | 'scanning' | 'error'
  const [error,      setError]      = useState(null);
  const [torchOn,    setTorchOn]    = useState(false);
  const [torchCapable, setTorchCapable] = useState(false);
  const [engine,     setEngine]     = useState('native'); // 'native' | 'zxing'

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (zxingReaderRef.current) {
      try { zxingReaderRef.current.reset(); } catch {}
      zxingReaderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    tickingRef.current = false;
  }, []);

  const handleDetection = useCallback((text) => {
    if (!text) return;
    const value = String(text).trim();
    if (!value) return;
    // Debounce duplicates within 1s window
    if (lastResultRef.current && lastResultRef.current.value === value && Date.now() - lastResultRef.current.t < 1000) return;
    lastResultRef.current = { value, t: Date.now() };
    playBeep();
    stop();
    onDetected?.(value);
    onClose?.();
  }, [onDetected, onClose, stop]);

  const tickNative = useCallback(async () => {
    if (!videoRef.current || !detectorRef.current || tickingRef.current) return;
    tickingRef.current = true;
    try {
      const results = await detectorRef.current.detect(videoRef.current);
      if (results && results.length > 0) {
        handleDetection(results[0].rawValue);
        return;
      }
    } catch { /* keep scanning */ }
    finally {
      tickingRef.current = false;
    }
    rafRef.current = requestAnimationFrame(tickNative);
  }, [handleDetection]);

  const startNative = useCallback(async () => {
    const detector = new window.BarcodeDetector({ formats: SUPPORTED_FORMATS });
    detectorRef.current = detector;
    setEngine('native');
    rafRef.current = requestAnimationFrame(tickNative);
  }, [tickNative]);

  const startZxing = useCallback(async () => {
    setEngine('zxing');
    // Lazy-load @zxing/browser from CDN (no npm install needed)
    const mod = await import(/* @vite-ignore */ 'https://esm.sh/@zxing/browser@0.1.5');
    const reader = new mod.BrowserMultiFormatReader();
    zxingReaderRef.current = reader;
    if (!videoRef.current) return;
    reader.decodeFromVideoElement(videoRef.current, (result, err) => {
      if (result) handleDetection(result.getText());
    });
  }, [handleDetection]);

  const start = useCallback(async () => {
    setStatus('starting');
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width:  { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      // Check for torch capability
      const track = stream.getVideoTracks()[0];
      const caps = track?.getCapabilities?.() || {};
      setTorchCapable(!!caps.torch);

      setStatus('scanning');
      if ('BarcodeDetector' in window) {
        await startNative();
      } else {
        await startZxing();
      }
    } catch (err) {
      console.error('Scanner start failed', err);
      setStatus('error');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera permission denied. Please allow camera access in your browser settings and try again.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No camera found on this device.');
      } else if (err.message?.includes('esm.sh') || err.message?.includes('fetch')) {
        setError('Could not load fallback scanner library. Check your internet connection and try again.');
      } else {
        setError(err.message || 'Failed to start camera.');
      }
    }
  }, [startNative, startZxing]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track) return;
    try {
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch (err) {
      console.warn('Torch toggle failed', err);
    }
  }, [torchOn]);

  useEffect(() => {
    if (!open) return;
    start();
    return () => stop();
  }, [open, start, stop]);

  if (!open) return null;

  return (
    <div className="bsm-backdrop" onClick={onClose}>
      <div className="bsm-modal" onClick={e => e.stopPropagation()}>
        <div className="bsm-head">
          <div className="bsm-title">
            <Camera size={16} /> {title}
          </div>
          <button className="bsm-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="bsm-viewport">
          <video
            ref={videoRef}
            className="bsm-video"
            playsInline
            autoPlay
            muted
          />
          <div className="bsm-reticle" />
          {status === 'scanning' && (
            <div className="bsm-hint-overlay">
              Point the camera at a barcode
            </div>
          )}
          {status === 'starting' && (
            <div className="bsm-overlay">
              <div className="bsm-spinner" />
              <div>Starting camera…</div>
            </div>
          )}
          {status === 'error' && (
            <div className="bsm-overlay bsm-overlay--error">
              <AlertCircle size={28} />
              <div className="bsm-error-text">{error}</div>
              <button className="bsm-retry" onClick={start}>
                <RefreshCcw size={13} /> Try again
              </button>
            </div>
          )}
        </div>

        <div className="bsm-foot">
          <div className="bsm-foot-left">
            <span className="bsm-engine">
              Engine: {engine === 'native' ? 'BarcodeDetector (native)' : '@zxing/browser (fallback)'}
            </span>
          </div>
          <div className="bsm-foot-right">
            {torchCapable && status === 'scanning' && (
              <button className="bsm-torch" onClick={toggleTorch}>
                {torchOn ? <><ZapOff size={13} /> Torch off</> : <><Zap size={13} /> Torch on</>}
              </button>
            )}
            <button className="bsm-cancel" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
