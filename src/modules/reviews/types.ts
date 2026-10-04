export type ReviewTarget = 'vendor' | 'logistics'

export interface Review {
  id: string
  target: ReviewTarget
  /** Vendor id (vnd_… or v1…) or courier id. */
  targetId: string
  targetName: string
  orderId: string
  /** Real purchases only. Reviews without an order are impossible. */
  authorEmail: string
  /** "Chidinma O." Never the full name or email. */
  authorLabel: string
  rating: 1 | 2 | 3 | 4 | 5
  body: string
  createdAt: string
  status: 'published' | 'hidden'
  hiddenReason?: string
  reply?: { body: string; at: string }
  /** DEV sample data only. */
  sample?: boolean
}
