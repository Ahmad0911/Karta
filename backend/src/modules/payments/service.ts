import type { Deps } from '../../deps.ts'
import { iso } from '../../platform/clock.ts'
import { all, get, run, tx } from '../../platform/db.ts'
import type { PaystackVerify } from '../../platform/paystack.ts'
import { audit } from '../audit/audit.ts'

export interface PaymentRow {
  reference: string; order_id: string; provider: string; amount_kobo: number; paid_amount_kobo: number | null
  status: 'pending' | 'paid' | 'failed' | 'abandoned'; created_at: string; paid_at: string | null
}

const SYSTEM = { id: 'system', role: 'system' }

/**
 * Applies a provider-VERIFIED result to our records. Safe to call any number of times, from the redirect
 * page, a retry, or a webhook: the first success wins and later calls change nothing.
 * Money is only trusted when the amount and currency equal what WE asked for.
 */
export function settle(deps: Deps, reference: string, v: PaystackVerify): PaymentRow {
  return tx(deps.db, () => {
    const p = get<PaymentRow>(deps.db, 'SELECT * FROM payments WHERE reference = ?', reference)
    if (!p) throw new Error('unknown payment reference')
    if (p.status === 'paid') return p

    const now = iso(deps.clock.now())

    if (v.status === 'success') {
      if (v.currency !== 'NGN' || v.amountKobo !== p.amount_kobo) {
        // Money moved but not the amount we expect. Give nothing, tell staff.
        run(deps.db, "UPDATE payments SET status = 'failed', paid_amount_kobo = ? WHERE reference = ?", v.amountKobo, reference)
        audit(deps, null, { actor: SYSTEM, action: 'payment.amount_mismatch', entityType: 'payment', entityId: reference, meta: { expectedKobo: p.amount_kobo, paidKobo: v.amountKobo, currency: v.currency } })
        return get<PaymentRow>(deps.db, 'SELECT * FROM payments WHERE reference = ?', reference) as PaymentRow
      }

      run(deps.db, "UPDATE payments SET status = 'paid', paid_amount_kobo = ?, paid_at = ? WHERE reference = ?", v.amountKobo, now, reference)
      const order = get<{ status: string }>(deps.db, 'SELECT status FROM orders WHERE id = ?', p.order_id)

      if (order?.status === 'awaiting_payment') {
        run(deps.db, "UPDATE orders SET status = 'paid', paid_at = ? WHERE id = ?", now, p.order_id)
        for (const l of all<{ listing_id: string; qty: number }>(deps.db, 'SELECT listing_id,qty FROM order_lines WHERE order_id = ?', p.order_id)) {
          const r = run(deps.db, 'UPDATE listings SET stock = stock - ? WHERE id = ? AND stock >= ?', l.qty, l.listing_id, l.qty)
          // Someone else bought the last one first. The customer paid, so staff must refund or restock.
          if (r.changes === 0) audit(deps, null, { actor: SYSTEM, action: 'payment.oversold', entityType: 'order', entityId: p.order_id, meta: { listingId: l.listing_id } })
        }
        audit(deps, null, { actor: SYSTEM, action: 'payment.paid', entityType: 'order', entityId: p.order_id, meta: { reference, amountKobo: v.amountKobo } })
      } else {
        // Paid twice (e.g. two checkout tabs): staff should refund the extra one.
        audit(deps, null, { actor: SYSTEM, action: 'payment.duplicate', entityType: 'payment', entityId: reference, meta: { orderId: p.order_id } })
      }
    } else if (v.status === 'failed' || v.status === 'abandoned') {
      run(deps.db, 'UPDATE payments SET status = ? WHERE reference = ?', v.status, reference)
    }
    return get<PaymentRow>(deps.db, 'SELECT * FROM payments WHERE reference = ?', reference) as PaymentRow
  })
}
