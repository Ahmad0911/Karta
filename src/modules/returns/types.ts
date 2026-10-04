export type ReturnReason = 'damaged' | 'defective' | 'not_as_described' | 'wrong_item' | 'other'

/**
 * requested  → waiting for the vendor
 * approved   → vendor (or Karta) agreed; the item is to be collected
 * rejected   → vendor declined; the customer may escalate
 * escalated  → Karta staff will decide
 * received   → the item is back; refund can be issued
 * refunded   → money returned through the payment provider
 * closed     → cancelled by the customer, or dismissed by Karta
 */
export type ReturnStatus =
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'escalated'
  | 'received'
  | 'refunded'
  | 'closed'

export interface ReturnLine {
  productId: string
  name: string
  qty: number
  unitPrice: number
  vendorId: string
  vendorName: string
  /** Absent for seed vendors that have no portal; Karta handles those. */
  vendorEmail?: string
}

export interface ReturnEvent {
  id: string
  at: string
  by: 'customer' | 'vendor' | 'admin' | 'system'
  action: string
  note?: string
}

export interface RefundInfo {
  amount: number
  status: 'completed' | 'pending'
  reference?: string
  provider: string
  at: string
  /** Delivery fee was included (fault + whole order returned). */
  includesDelivery: boolean
}

export interface ReturnRequest {
  id: string
  number: string
  orderId: string
  orderNumber: string
  customerEmail: string
  customerLabel: string
  lines: ReturnLine[]
  reason: ReturnReason
  details: string
  /** Compressed data URLs in the mock; storage URLs once the API exists. */
  photos: string[]
  status: ReturnStatus
  vendorNote?: string
  customerNote?: string
  adminNote?: string
  refund?: RefundInfo
  events: ReturnEvent[]
  createdAt: string
  updatedAt: string
}
