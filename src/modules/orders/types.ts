import type { ProviderId } from '@/modules/payments'

export type CustomerOrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'delivered'
  | 'cancelled'

export interface DeliveryAddress {
  fullName: string
  phone: string
  street: string
  city: string
  state: string
  landmark?: string
}

export interface CustomerOrderLine {
  productId: string
  name: string
  qty: number
  unitPrice: number
  assembly: boolean
  vendorId: string
  vendorName: string
  /** Set for platform vendors; seed demo vendors have no portal. */
  vendorEmail?: string
}

export interface CustomerOrder {
  id: string
  number: string
  customerEmail: string
  customerName: string
  placedAt: string

  lines: CustomerOrderLine[]
  address: DeliveryAddress

  subtotal: number
  assemblyFee: number
  deliveryFee: number
  total: number

  status: CustomerOrderStatus
  payment: {
    provider?: ProviderId
    reference?: string
    status: 'pending' | 'paid' | 'failed' | 'abandoned'
    paidAt?: string
    failureNote?: string
  }

  courier: { id: string; name: string }
  deliveredAt?: string

  /** Total returned to the customer so far (never more than `total`). */
  refundedTotal?: number
  deliveryRefunded?: boolean
}
