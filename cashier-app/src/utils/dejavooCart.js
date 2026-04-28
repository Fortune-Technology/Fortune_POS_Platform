/**
 * Build a Dejavoo SPIn `Cart` object from our useCartStore items + totals.
 *
 * The Cart object goes on a /v2/Payment/Sale request and triggers the P17 to
 * display the itemised cart on the customer-facing screen during the card
 * prompt. Format per the Theneo SPIn REST API spec:
 *
 *   POST /v2/Payment/Sale
 *   {
 *     "Cart": {
 *       "Amounts": [
 *         {"Name": "Subtotal", "Value": 19.84},
 *         {"Name": "Taxes",    "Value": 2.75},
 *         {"Name": "Total",    "Value": 22.59}
 *       ],
 *       "CashPrices": [...],   // optional dual-pricing — leave empty for now
 *       "Items": [
 *         {
 *           "Name": "Bottle of Milk",
 *           "Price": 5.18,         // line total
 *           "UnitPrice": 5.18,     // per-unit
 *           "Quantity": 1,
 *           "AdditionalInfo": "",  // brand / SKU / etc.
 *           "CustomInfos": [],
 *           "Modifiers": []
 *         }
 *       ]
 *     }
 *   }
 *
 * Field-name casing matters — Dejavoo's API is case-sensitive.
 *
 * @param {Array}  items   useCartStore.items[] — raw cart line items
 * @param {Object} totals  selectTotals() output { subtotal, taxTotal, depositTotal, grandTotal, ... }
 * @param {Object} opts
 *   chargeAmount {number} — when paying a partial split, the Cart should
 *                           reflect the AMOUNT BEING CHARGED, not the cart
 *                           grand total (otherwise the customer sees $20
 *                           on the prompt while only $5 is being charged
 *                           on this card). Defaults to grandTotal.
 *   maxItems     {number} — cap the items array to avoid huge payloads on
 *                           bulk-scan carts. Defaults to 50.
 *
 * @returns {Object|null} Cart object ready to drop into the Sale body, or
 *   null when the cart is empty / inputs are invalid.
 */
export function buildDejavooCart(items, totals, opts = {}) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const grandTotal = Number(totals?.grandTotal);
  if (!Number.isFinite(grandTotal)) return null;

  const chargeAmount = Number.isFinite(opts.chargeAmount) ? opts.chargeAmount : grandTotal;
  const maxItems     = Number.isInteger(opts.maxItems) ? opts.maxItems : 50;

  // Round helper — Dejavoo expects numbers with up to 2 decimals.
  const r = (n) => Math.round(Number(n) * 100) / 100;

  // Translate one cart line into Dejavoo's Item shape. Skip items that
  // can't be meaningfully displayed (no name, no qty, no price).
  const toCartItem = (line) => {
    const name = String(
      line.name ||
      line.productName ||
      line.label ||
      ''
    ).trim();
    if (!name) return null;
    const qty = Number(line.qty);
    if (!Number.isFinite(qty) || qty === 0) return null;
    // Use effectivePrice when we have a discount applied, else unitPrice.
    const unit = Number(line.effectivePrice ?? line.unitPrice ?? 0);
    const total = Number(line.lineTotal ?? unit * qty);

    // Build optional sub-text the terminal can show under the item name.
    // Useful for SKU/brand context. Cap length so it doesn't wrap weirdly.
    const additional = [];
    if (line.brand) additional.push(String(line.brand));
    if (line.upc)   additional.push(String(line.upc));
    const additionalInfo = additional.join(' · ').slice(0, 60);

    return {
      Name:       name.slice(0, 60),     // sane limit; terminals truncate anyway
      Price:      r(total),               // line total
      UnitPrice:  r(unit),
      Quantity:   qty,
      AdditionalInfo: additionalInfo,
      CustomInfos:    [],
      Modifiers:      [],
    };
  };

  const dejavooItems = items
    .map(toCartItem)
    .filter(Boolean)
    .slice(0, maxItems);

  if (dejavooItems.length === 0) return null;

  // Cart-level Amounts. Dejavoo accepts arbitrary {Name, Value} pairs and
  // displays them as labeled rows on the terminal. Standard presentation:
  //   Subtotal · Taxes · (Deposits if any) · Total
  // When charging less than the full cart (split payment), we annotate
  // explicitly so the customer doesn't see the full grand total + a
  // smaller charge prompt and get confused.
  const amounts = [];
  if (Number.isFinite(totals?.subtotal)) {
    amounts.push({ Name: 'Subtotal', Value: r(totals.subtotal) });
  }
  if (Number.isFinite(totals?.taxTotal) && totals.taxTotal > 0) {
    amounts.push({ Name: 'Tax', Value: r(totals.taxTotal) });
  }
  if (Number.isFinite(totals?.depositTotal) && totals.depositTotal > 0) {
    amounts.push({ Name: 'Deposit', Value: r(totals.depositTotal) });
  }
  amounts.push({ Name: 'Cart Total', Value: r(grandTotal) });

  // When the charge amount is a partial (split tender), surface that on
  // the prompt as a separate line so the customer understands what they're
  // paying for on THIS card.
  if (Math.abs(chargeAmount - grandTotal) > 0.005) {
    amounts.push({ Name: 'Charging Now', Value: r(chargeAmount) });
  }

  return {
    Amounts:    amounts,
    CashPrices: [],     // empty unless dual-pricing (cash discount) is enabled
    Items:      dejavooItems,
  };
}
