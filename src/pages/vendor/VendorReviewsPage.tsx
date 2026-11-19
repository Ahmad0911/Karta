import { PageHeader } from '@/components/portal/ui'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { vendorIdFor } from '@/modules/catalog/vendorId'
import ReviewsPanel from '@/modules/reviews/components/ReviewsPanel'
import { useReviewsStore } from '@/modules/reviews/reviews.store'
import { useVendor } from '@/modules/vendors/hooks/useVendor'

export default function VendorReviewsPage() {
  useDocumentTitle('Reviews')

  const { email } = useVendor()
  const id = vendorIdFor(email)
  const all = useReviewsStore((s) => s.reviews)

  const mine = all.filter((r) => r.target === 'vendor' && r.targetId === id)
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Reputation"
        title="Customer reviews"
        description="Every review comes from a customer whose order was delivered. Replies to customers are handled by Karta, and reviews can’t be edited or removed."
      />

      <ReviewsPanel
        reviews={mine}
        heading="Your reviews"
        emptyText="No reviews yet. They appear after a customer’s order is delivered."
      />
    </div>
  )
}
