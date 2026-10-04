/* -------------------------------------------------------------------------- */
/* Karta — Logistics domain (BRD §14)                                         */
/* -------------------------------------------------------------------------- */

/**
 * assigned          → Karta operations gave the job to this driver
 * picked_up         → collected from the vendor
 * in_transit        → on the road
 * out_for_delivery  → arriving at the customer
 * delivered         → handed over, proof captured
 * failed            → attempt failed (see failureReason); can be retried
 */
export type DeliveryStatus =
  | 'assigned'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed'

export type FailureReason =
  | 'customer_unreachable'
  | 'wrong_address'
  | 'customer_refused'
  | 'damaged_in_transit'
  | 'other'

export interface DeliveryEvent {
  status: DeliveryStatus
  at: string
  note?: string
}

export interface ProofOfDelivery {
  recipientName: string
  note?: string
  /** Compressed data URL in the mock; a storage URL once the API exists. */
  photo?: string
  deliveredAt: string
}

export interface Delivery {
  id: string
  orderNumber: string
  status: DeliveryStatus

  vendorName: string
  pickupAddress: string
  pickupPhone: string

  customerName: string
  customerPhone: string
  dropoffAddress: string
  city: string
  state: string

  /** Human-readable item list, e.g. "Kano Six-Seater Dining Table × 1". */
  items: string[]
  assemblyRequested: boolean
  /** Fragile / heavy handling note shown to the driver. */
  handlingNote?: string

  /** ISO date (yyyy-mm-dd) the job is scheduled for. */
  scheduledFor: string
  assignedAt: string

  attempts: number
  failureReason?: FailureReason
  failureNote?: string

  /**
   * MOCK ONLY. In production the customer receives a one-time code by SMS
   * and the SERVER verifies it; the code is never sent to the driver app.
   */
  deliveryCode: string

  proof?: ProofOfDelivery
  events: DeliveryEvent[]
}

export interface LogisticsWorkspace {
  deliveries: Delivery[]
}
