import { useState } from 'react'

import { FormField, StatusPill, dangerBtn, primaryBtn, secondaryBtn, textareaClass } from '@/components/portal/ui'
import { formatDateTime } from '@/lib/date'
import { toast } from '@/store/toast.store'
import { CATEGORIES, STATUS, useSupportStore, visibleMessages, type SupportTicket, type TicketStatus } from './support.store'

/** A support conversation. `viewer` decides what is visible and allowed. */
export default function Thread({ ticket, viewer }: { ticket: SupportTicket; viewer: 'requester' | 'staff' }) {
  const store = useSupportStore()
  const [text, setText] = useState('')
  const [internal, setInternal] = useState(false)
  const [error, setError] = useState('')

  const meta = STATUS[ticket.status]
  const closed = ticket.status === 'closed'

  const send = (status?: TicketStatus) => {
    const r = viewer === 'staff' ? store.staffReply(ticket.id, text, { internal, status }) : store.reply(ticket.id, text)
    if (!r.ok) return setError(r.error)
    setText('')
    setInternal(false)
    setError('')
    toast.success(internal ? 'Internal note saved' : 'Message sent')
  }

  const setStatus = (s: TicketStatus) => {
    const r = store.staffSetStatus(ticket.id, s)
    if (r.ok) toast.success(`Marked ${STATUS[s].label.toLowerCase()}`)
    else toast.error(r.error)
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#151b1c]/[0.07] px-5 py-4 sm:px-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8f7651]">{ticket.number} · {CATEGORIES[ticket.category]}</p>
          <h3 className="mt-1 font-display text-xl tracking-[-0.02em]">{ticket.subject}</h3>
          <p className="text-xs text-[#151b1c]/45">{viewer === 'staff' ? `${ticket.requesterName} · ${ticket.requesterEmail} · ` : ''}Opened {formatDateTime(ticket.createdAt)}</p>
        </div>
        <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
      </div>

      <ol className="space-y-4 px-5 py-5 sm:px-6">
        {visibleMessages(ticket, viewer).map((m) => {
          const mine = (m.from === 'requester') === (viewer === 'requester')
          return (
            <li key={m.id} className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6 ${m.internal ? 'border border-dashed border-[#b7791f]/50 bg-[#b7791f]/[0.07]' : mine ? 'ml-auto bg-[#151b1c] text-white' : 'bg-[#151b1c]/[0.05]'}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${mine && !m.internal ? 'text-white/55' : 'text-[#151b1c]/45'}`}>
                {m.internal ? 'Internal note · ' : ''}{m.author} · {formatDateTime(m.at)}
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words">{m.body}</p>
            </li>
          )
        })}
      </ol>

      <div className="space-y-3 border-t border-[#151b1c]/[0.07] bg-[#151b1c]/[0.02] px-5 py-5 sm:px-6">
        {closed && viewer === 'requester' ? (
          <p className="text-sm text-[#151b1c]/55">This request is closed. If you still need help, please start a new one.</p>
        ) : (
          <>
            <FormField id={`reply-${ticket.id}`} label={viewer === 'staff' ? 'Reply' : ticket.status === 'resolved' ? 'Still need help? Reply to reopen' : 'Your reply'} error={error}>
              <textarea id={`reply-${ticket.id}`} className={textareaClass(!!error)} value={text} aria-invalid={error ? true : undefined} aria-describedby={`reply-${ticket.id}-msg`} onChange={(e) => { setText(e.target.value); setError('') }} />
            </FormField>

            {viewer === 'staff' && (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" className="accent-[#151b1c]" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> Internal note (the customer won’t see it)
              </label>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              {viewer === 'requester' && !closed && <button type="button" className={secondaryBtn} onClick={() => { store.close(ticket.id); toast.success('Request closed') }}>Close request</button>}
              {viewer === 'staff' && (
                <>
                  {ticket.status !== 'closed' && <button type="button" className={dangerBtn} onClick={() => setStatus('closed')}>Close</button>}
                  {ticket.status !== 'resolved' && ticket.status !== 'closed' && <button type="button" className={secondaryBtn} onClick={() => setStatus('resolved')}>Mark resolved</button>}
                </>
              )}
              <button type="button" className={primaryBtn} disabled={text.trim().length < 2} onClick={() => send(viewer === 'staff' ? 'pending' : undefined)}>
                {viewer === 'staff' ? (internal ? 'Save note' : 'Send reply') : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
