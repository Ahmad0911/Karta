import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

import { Card, FormField, Notice, PageHeader, inputClass, primaryBtn, secondaryBtn, textareaClass } from '@/components/portal/ui'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useOrdersStore } from '@/modules/orders/orders.store'
import { CATEGORIES, LIMITS, useSupportStore, type TicketCategory } from '@/modules/support/support.store'
import { useAuthStore } from '@/store/auth.store'
import { toast } from '@/store/toast.store'

export default function AccountSupportNewPage() {
  useDocumentTitle('New support request')

  const navigate = useNavigate()
  const [params] = useSearchParams()
  const me = useAuthStore((s) => s.user)!.email.trim().toLowerCase()
  const allOrders = useOrdersStore((s) => s.orders)
  const orders = allOrders.filter((o) => o.customerEmail === me)
  const create = useSupportStore((s) => s.create)

  const [category, setCategory] = useState<TicketCategory>(params.get('order') ? 'order' : 'other')
  const [orderId, setOrderId] = useState(params.get('order') ?? '')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const r = create({ subject, category, message, orderId: orderId || undefined })
    if (!r.ok) return setError(r.error)
    toast.success('Request sent. We’ll reply here.')
    navigate(`/account/support/${r.data.id}`, { replace: true })
  }

  return (
    <main className="min-h-screen bg-[#f8f6f1] text-[#151b1c]">
      <div className="container-x max-w-2xl space-y-8 py-12 sm:py-16">
        <Link to="/account/support" className="inline-flex items-center gap-2 text-xs font-semibold text-[#151b1c]/55 hover:text-[#151b1c]"><ArrowLeft className="h-4 w-4" /> Support</Link>
        <PageHeader eyebrow="Help" title="Contact support" />

        {category === 'return' && (
          <Notice tone="info" title="Want to return something?">
            You can start a return yourself, and it’s faster. <Link to="/account/returns" className="font-semibold underline underline-offset-4">Go to returns</Link>.
          </Notice>
        )}

        <Card className="p-5 sm:p-7">
          <form onSubmit={submit} className="space-y-5" noValidate>
            <FormField id="s-category" label="What is this about?" required>
              <select id="s-category" className={inputClass()} value={category} onChange={(e) => setCategory(e.target.value as TicketCategory)}>
                {(Object.keys(CATEGORIES) as TicketCategory[]).map((c) => <option key={c} value={c}>{CATEGORIES[c]}</option>)}
              </select>
            </FormField>

            {orders.length > 0 && (
              <FormField id="s-order" label="Which order? (optional)">
                <select id="s-order" className={inputClass()} value={orderId} onChange={(e) => setOrderId(e.target.value)}>
                  <option value="">Not about a specific order</option>
                  {orders.map((o) => <option key={o.id} value={o.id}>{o.number} · {o.lines[0].name}</option>)}
                </select>
              </FormField>
            )}

            <FormField id="s-subject" label="Subject" required hint="A short summary.">
              <input id="s-subject" className={inputClass()} maxLength={LIMITS.subject[1]} value={subject} aria-describedby="s-subject-msg" onChange={(e) => { setSubject(e.target.value); setError('') }} />
            </FormField>

            <FormField id="s-message" label="How can we help?" required hint={`${message.trim().length}/${LIMITS.body[1]}`}>
              <textarea id="s-message" className={textareaClass()} maxLength={LIMITS.body[1]} value={message} aria-describedby="s-message-msg" onChange={(e) => { setMessage(e.target.value); setError('') }} />
            </FormField>

            <p className="text-xs leading-5 text-[#151b1c]/50">Never share your password or a verification code. Karta staff will never ask for them.</p>

            {error && <p role="alert" className="text-sm text-[#9b302d]">{error}</p>}

            <div className="flex justify-end gap-2">
              <Link to="/account/support" className={secondaryBtn}>Cancel</Link>
              <button className={primaryBtn}>Send request</button>
            </div>
          </form>
        </Card>
      </div>
    </main>
  )
}
