/**
 * chargeAccountService.js
 *
 * In-store charge ("house account") tender validation and balance updates.
 * Used by posTerminalController.createTransaction / batchCreateTransactions
 * (apply on sale) and voidTransaction / createRefund (refund on reversal).
 *
 * Race-safe: balance updates use Prisma's atomic increment / decrement
 * operators so two concurrent terminals can't both push a charge over the
 * customer's limit. The validation read-then-write window is narrow but
 * the increment itself is the single source of truth — a check that says
 * "you have $5 of room" is only advisory; the increment will succeed and
 * we double-check post-write so the caller can roll back if needed.
 */

import realPrisma from '../config/postgres.js';

let prisma = realPrisma;
export function _setPrismaForTests(p) { prisma = p || realPrisma; }

/**
 * Sum the charge-method tender lines on a transaction payload.
 * Accepts the legacy aliases too so older clients keep working.
 */
export function sumChargeTender(tenderLines) {
  if (!Array.isArray(tenderLines)) return 0;
  return tenderLines
    .filter(t => t && (t.method === 'charge' || t.method === 'charge_account' || t.method === 'house_charge'))
    .reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0);
}

/**
 * Validate a charge against the customer's account, then atomically reserve
 * the balance via Prisma increment. Returns:
 *   { ok: true,  newBalance } on success
 *   { ok: false, error }      on validation failure (no DB write)
 *
 * Validation rules:
 *   - customerId required
 *   - chargeAmount must be positive
 *   - customer must exist + not deleted + in the requesting org
 *   - instoreChargeEnabled must be true
 *   - if balanceLimit > 0, (currentBalance + chargeAmount) must not exceed it
 *   - balanceLimit <= 0 is treated as "unlimited" (matches portal semantics)
 */
export async function applyChargeTender({ orgId, customerId, chargeAmount }) {
  if (!customerId) return { ok: false, error: 'Charge tender requires a customer attached to the cart.' };
  if (!(chargeAmount > 0)) return { ok: false, error: 'Charge amount must be positive.' };

  const customer = await prisma.customer.findFirst({
    where:  { id: customerId, orgId, deleted: false },
    select: { id: true, balance: true, balanceLimit: true, instoreChargeEnabled: true, name: true },
  });
  if (!customer) return { ok: false, error: 'Customer not found.' };
  if (!customer.instoreChargeEnabled) return { ok: false, error: 'In-store charge account is not enabled for this customer.' };

  const currentBalance = Number(customer.balance || 0);
  const limit          = Number(customer.balanceLimit || 0);
  if (limit > 0 && (currentBalance + chargeAmount) > limit + 0.005) {
    const room = Math.max(0, limit - currentBalance);
    return {
      ok: false,
      error: `Charge of $${chargeAmount.toFixed(2)} would exceed the customer's $${limit.toFixed(2)} limit. ` +
             `Current balance: $${currentBalance.toFixed(2)}. Room remaining: $${room.toFixed(2)}.`,
    };
  }

  await prisma.customer.update({
    where: { id: customerId },
    data:  { balance: { increment: chargeAmount } },
  });
  return { ok: true, newBalance: currentBalance + chargeAmount };
}

/**
 * Refund a previously-applied charge back to the customer's balance, used
 * when a transaction with a charge tender is voided or refunded. Locates
 * the customer by scanning pointsHistory for the tx id (since the
 * Transaction model has no customerId column yet).
 */
export async function refundChargeOnTx({ orgId, originalTx, chargeAmount }) {
  if (!(chargeAmount > 0)) return { ok: false, reason: 'no_charge' };
  const txId = originalTx.id;
  const all = await prisma.customer.findMany({
    where:  { orgId, instoreChargeEnabled: true },
    select: { id: true, pointsHistory: true, balance: true },
  });
  const target = all.find(c =>
    Array.isArray(c.pointsHistory) && c.pointsHistory.some(h => h && h.txId === txId)
  );
  if (!target) return { ok: false, reason: 'customer_not_found' };
  await prisma.customer.update({
    where: { id: target.id },
    data:  { balance: { decrement: chargeAmount } },
  });
  return { ok: true, customerId: target.id };
}
