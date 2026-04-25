/**
 * sftpService.js — SFTP upload for scan-data submissions (Session 47).
 *
 * Dynamic-import pattern (same as smsService.js): the `ssh2-sftp-client`
 * package is loaded lazily so the rest of the scan-data pipeline works in
 * dry-run mode WITHOUT the dependency installed. To activate real SFTP:
 *
 *   cd backend
 *   npm i ssh2-sftp-client
 *   pm2 restart api-pos
 *
 * After install, real uploads happen automatically — no callsite changes.
 *
 * Retry policy: 3 attempts with exponential backoff (1s, 4s, 16s). After
 * exhaustion, throws — generator.js catches and marks the submission row
 * `status='failed'` with the last error message.
 */

import fs from 'fs';
import { decrypt } from '../../utils/cryptoVault.js';

let _SftpClient = null;
let _loadAttempted = false;

async function loadSftpClient() {
  if (_SftpClient) return _SftpClient;
  if (_loadAttempted) return null;
  _loadAttempted = true;

  try {
    const mod = await import('ssh2-sftp-client');
    _SftpClient = mod.default || mod;
    console.log('[ScanData/SFTP] ssh2-sftp-client loaded.');
    return _SftpClient;
  } catch (err) {
    console.warn('[ScanData/SFTP] ssh2-sftp-client not installed:', err.message);
    console.warn('[ScanData/SFTP] Submissions will write files locally but skip SFTP upload.');
    console.warn('[ScanData/SFTP] To enable real uploads: cd backend && npm i ssh2-sftp-client');
    return null;
  }
}

/**
 * Upload a single file via SFTP. Returns { uploaded, skipped, attempts, error? }.
 *
 * Args:
 *   enrollment       — ScanDataEnrollment row (host/port/username/passwordEnc/path)
 *   localFilePath    — absolute path of the file on disk
 *   remoteFilename   — target filename on the SFTP server
 *   onAttempt(n,err) — optional progress callback (for logging into the submission row)
 */
export async function uploadFile({ enrollment, localFilePath, remoteFilename, onAttempt }) {
  const SftpClient = await loadSftpClient();

  // Stub mode — package not installed
  if (!SftpClient) {
    return {
      uploaded: false,
      skipped:  true,
      attempts: 0,
      error:    'ssh2-sftp-client not installed (run: npm i ssh2-sftp-client). File written locally only.',
    };
  }

  // Stub mode — host not configured (still in cert-prep stage)
  if (!enrollment.sftpHost) {
    return {
      uploaded: false,
      skipped:  true,
      attempts: 0,
      error:    'No SFTP host configured for this enrollment.',
    };
  }

  const password = enrollment.sftpPasswordEnc ? decrypt(enrollment.sftpPasswordEnc) : null;
  const remotePath = (enrollment.sftpPath || '/upload/').replace(/\/+$/, '') + '/' + remoteFilename;

  const MAX_ATTEMPTS = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const sftp = new SftpClient();
    try {
      await sftp.connect({
        host:     enrollment.sftpHost,
        port:     enrollment.sftpPort || 22,
        username: enrollment.sftpUsername,
        password: password || undefined,
        readyTimeout: 30000,
      });

      await sftp.fastPut(localFilePath, remotePath);
      await sftp.end();

      onAttempt?.(attempt, null);
      return { uploaded: true, skipped: false, attempts: attempt };
    } catch (err) {
      lastError = err;
      onAttempt?.(attempt, err);
      console.warn(`[ScanData/SFTP] attempt ${attempt}/${MAX_ATTEMPTS} failed: ${err.message}`);
      try { await sftp.end(); } catch {}

      if (attempt < MAX_ATTEMPTS) {
        // Exponential backoff: 1s, 4s, 16s
        const delay = Math.pow(4, attempt - 1) * 1000;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  return {
    uploaded: false,
    skipped:  false,
    attempts: MAX_ATTEMPTS,
    error:    lastError?.message || 'unknown SFTP error',
  };
}

/**
 * Quick connection check — used by the back-office "Test Connection" button
 * (Session 48). Connects, lists the upload dir, returns success/error.
 */
export async function testConnection(enrollment) {
  const SftpClient = await loadSftpClient();
  if (!SftpClient) {
    return { ok: false, error: 'ssh2-sftp-client not installed' };
  }
  if (!enrollment.sftpHost || !enrollment.sftpUsername) {
    return { ok: false, error: 'SFTP host or username not configured' };
  }
  const password = enrollment.sftpPasswordEnc ? decrypt(enrollment.sftpPasswordEnc) : null;
  const sftp = new SftpClient();
  try {
    await sftp.connect({
      host:     enrollment.sftpHost,
      port:     enrollment.sftpPort || 22,
      username: enrollment.sftpUsername,
      password: password || undefined,
      readyTimeout: 15000,
    });
    const list = await sftp.list(enrollment.sftpPath || '/upload/');
    await sftp.end();
    return { ok: true, fileCount: list.length, samples: list.slice(0, 5).map(f => f.name) };
  } catch (err) {
    try { await sftp.end(); } catch {}
    return { ok: false, error: err.message };
  }
}

/**
 * Verify a local file exists + is readable. Used by generator before
 * starting the upload to catch fs issues early.
 */
export function verifyLocalFile(localFilePath) {
  try {
    const st = fs.statSync(localFilePath);
    return { ok: true, size: st.size };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
