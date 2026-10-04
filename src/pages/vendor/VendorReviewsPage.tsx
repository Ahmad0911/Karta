import { useState } from 'react'

import { FormField, PageHeader, secondaryBtn, textareaClass } from '@/components/portal/ui'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { toast } from '@/store/toast.store'
import { vendorIdFor } from '@/modules/catalog/vendorId'
import ReviewsPanel from '@/modules/reviews/components/ReviewsPanel'
import { useReviewsStore } from '@/modules/reviews/reviews.store'
import { useVendor } from '@/modules/vendors/hooks/useVendor'

export default function VendorReviewsPage() {
  useDocumentTitle('Reviews')

  const { email } = useVendor()
  const id = vendorIdFor(email)
  const all = useReviewsStore((s) => s.reviews)
  const reply = useReviewsStore((s) => s.reply)

  const mine = all.filter((r) => r.target === 'vendor' && r.targetId === id)
  const [replying, setReplying] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  const send = (reviewId: string) => {
    const r = reply(reviewId, text)
    if (!r.ok) {
      setError(r.error)
      return
    }
    toast.success('Reply posted')
    setReplying(null)
    setText('')
    setError('')
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Reputation"
        title="Customer reviews"
        description="Every review comes from a customer whose order was delivered. You can reply once to each, but you can’t edit or remove reviews."
      />

      <ReviewsPanel
        reviews={mine}
        heading="Your reviews"
        emptyText="No reviews yet. They appear after a customer’s order is delivered."
        renderActions={(r) =>
          r.reply ? null : replying === r.id ? (
            <div className="mt-4 space-y-3">
              <FormField id={`reply-${r.id}`} label="Your reply (public)" error={error}>
                <textarea
                  id={`reply-${r.id}`}
                  className={textareaClass(!!error)}
                  value={text}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={`reply-${r.id}-msg`}
                  onChange={(e) => { setText(e.target.value); setError('') }}
                />
              </FormField>
              <div className="flex gap-2">
                <button type="button" className={secondaryBtn} onClick={() => { setReplying(null); setError('') }}>Cancel</button>
                <button type="button" className="inline-flex h-11 items-center rounded-full bg-[#151b1c] px-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white" onClick={() => send(r.id)}>Post reply</button>
              </div>
            </div>
          ) : (
            <button type="button" className="mt-3 text-xs font-semibold text-[#8a6540] underline underline-offset-4" onClick={() => { setReplying(r.id); setText(''); setError('') }}>
              Reply
            </button>
          )
        }
      />
    </div>
  )
}
