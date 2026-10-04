import { useState } from 'react'

import { primaryBtn, textareaClass } from '@/components/portal/ui'
import { toast } from '@/store/toast.store'
import { REVIEW_LIMITS, useReviewsStore } from '../reviews.store'
import type { ReviewTarget } from '../types'
import { StarInput } from './Stars'

export default function ReviewForm({
  orderId,
  target,
  targetId,
  targetName,
  prompt,
  onDone,
}: {
  orderId: string
  target: ReviewTarget
  targetId: string
  targetName: string
  prompt: string
  onDone?: () => void
}) {
  const submit = useReviewsStore((s) => s.submit)

  const [rating, setRating] = useState(0)
  const [body, setBody] = useState('')
  const [error, setError] = useState('')

  const id = `review-${orderId}-${targetId}`

  const send = () => {
    if (!rating) {
      setError('Please choose a star rating.')
      return
    }

    const result = submit({ orderId, target, targetId, rating, body })
    if (!result.ok) {
      setError(result.error)
      return
    }

    toast.success('Thank you. Your review is live.')
    onDone?.()
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="font-display text-xl tracking-[-0.02em]">{targetName}</p>
        <p className="text-sm text-[#151b1c]/55">{prompt}</p>
      </div>

      <StarInput name={`${id}-rating`} value={rating} onChange={(n) => { setRating(n); setError('') }} />

      <div>
        <label htmlFor={id} className="sr-only">
          Your review of {targetName}
        </label>
        <textarea
          id={id}
          className={textareaClass(!!error)}
          value={body}
          maxLength={REVIEW_LIMITS.maxBody}
          placeholder="What was it like? Quality, communication, delivery…"
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-msg`}
          onChange={(e) => { setBody(e.target.value); setError('') }}
        />
        <p id={`${id}-msg`} className={`mt-1.5 text-xs ${error ? 'text-[#9b302d]' : 'text-[#151b1c]/40'}`} role={error ? 'alert' : undefined}>
          {error || `${body.trim().length}/${REVIEW_LIMITS.maxBody} · at least ${REVIEW_LIMITS.minBody} characters. Reviews are public and show your first name and last initial.`}
        </p>
      </div>

      <button type="button" className={primaryBtn} onClick={send}>
        Post review
      </button>
    </div>
  )
}
