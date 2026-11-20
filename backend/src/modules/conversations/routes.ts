import type { Deps } from '../../deps.ts'
import { iso } from '../../platform/clock.ts'
import { newId } from '../../platform/crypto.ts'
import { all, get, run, tx } from '../../platform/db.ts'
import { conflict, notFound, tooMany, unprocessable } from '../../platform/errors.ts'
import { requireRole, staffOnly, type Router } from '../../platform/http.ts'
import { bool, oneOf, optional, parse, str } from '../../platform/validate.ts'
import { audit } from '../audit/audit.ts'

const CATEGORIES = ['order', 'payment', 'delivery', 'return', 'account', 'vendor', 'request', 'other'] as const
const STATUSES = ['open', 'pending', 'resolved', 'closed'] as const
const MAX_OPEN = 5

interface ConvRow {
  id: string; number: string; requester_id: string; requester_role: 'customer' | 'vendor'; request_id: string | null; order_id: string | null
  subject: string; category: string; status: string; created_at: string; updated_at: string
}
interface MsgRow { id: string; sender: string; author_name: string; body: string; internal: number; created_at: string }

/**
 * The only place customers and vendors "talk". Each conversation is between ONE person and Karta staff:
 * a customer's thread is never readable by a vendor (or another customer), and the other way round.
 */
export function conversationRoutes(router: Router, deps: Deps) {
  const { db, clock, limiter } = deps
  const now = () => iso(clock.now())

  const messages = (id: string, includeInternal: boolean) =>
    all<MsgRow>(db, `SELECT id,sender,author_name,body,internal,created_at FROM conversation_messages WHERE conversation_id = ? ${includeInternal ? '' : 'AND internal = 0'} ORDER BY created_at, rowid`, id)
      .map((m) => ({ id: m.id, from: m.sender, author: m.author_name, body: m.body, at: m.created_at, ...(includeInternal ? { internal: m.internal === 1 } : {}) }))
  const dto = (c: ConvRow, staffView: boolean) => {
    const who = staffView ? get<{ email: string; name: string }>(db, 'SELECT email,name FROM users WHERE id = ?', c.requester_id) : undefined
    return {
      id: c.id, number: c.number, subject: c.subject, category: c.category, status: c.status, requestId: c.request_id, orderId: c.order_id,
      createdAt: c.created_at, updatedAt: c.updated_at, messages: messages(c.id, staffView),
      ...(staffView ? { requesterRole: c.requester_role, requesterEmail: who?.email, requesterName: who?.name } : {}),
    }
  }
  const mine = (id: string, userId: string) => {
    const c = get<ConvRow>(db, 'SELECT * FROM conversations WHERE id = ?', id)
    // Someone else's conversation looks exactly like a missing one.
    if (!c || c.requester_id !== userId) throw notFound('Conversation not found.')
    return c
  }
  const nextNumber = () => `SUP-${1001 + get<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM conversations')!.n}`

  const newShape = { subject: str({ min: 4, max: 120, label: 'The subject' }), category: oneOf(CATEGORIES), message: str({ min: 2, max: 2000, label: 'The message' }) }

  /* ------------------------- a customer or vendor ------------------------- */
  router.post('/api/conversations', requireRole('customer', 'vendor'), (ctx) => {
    const user = ctx.user!
    const b = parse({ ...newShape, orderId: optional(str({ max: 64 })), requestId: optional(str({ max: 64 })) }, ctx.body)
    const wait = limiter.check(`conv:${user.id}`, 10, 3_600_000)
    if (wait) throw tooMany(wait)

    return tx(db, () => {
      const open = get<{ n: number }>(db, "SELECT COUNT(*) AS n FROM conversations WHERE requester_id = ? AND status IN ('open','pending')", user.id)!.n
      if (open >= MAX_OPEN) throw conflict('too_many_open', `You have ${MAX_OPEN} open conversations. Please wait for a reply or close one.`)

      let orderId: string | undefined, requestId: string | undefined
      if (user.role === 'customer') {
        if (b.orderId) {
          if (!get(db, 'SELECT 1 AS x FROM orders WHERE id = ? AND customer_id = ?', b.orderId, user.id)) throw unprocessable('orderId', 'That order isn’t on your account.')
          orderId = b.orderId
        }
        if (b.requestId) {
          if (!get(db, 'SELECT 1 AS x FROM custom_requests WHERE id = ? AND customer_id = ?', b.requestId, user.id)) throw unprocessable('requestId', 'That request isn’t on your account.')
          requestId = b.requestId
        }
      } // vendors can't attach customer orders or requests: that would reveal customers to them.

      const id = newId()
      run(db, 'INSERT INTO conversations (id,number,requester_id,requester_role,request_id,order_id,subject,category,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        id, nextNumber(), user.id, user.role, requestId, orderId, b.subject, b.category, 'open', now(), now())
      run(db, 'INSERT INTO conversation_messages (id,conversation_id,sender,author_id,author_name,body,created_at) VALUES (?,?,?,?,?,?,?)', newId(), id, 'requester', user.id, user.name, b.message, now())
      ctx.json(201, dto(get<ConvRow>(db, 'SELECT * FROM conversations WHERE id = ?', id) as ConvRow, false))
    })
  })

  router.get('/api/conversations', requireRole('customer', 'vendor'), (ctx) =>
    ({ conversations: all<ConvRow>(db, 'SELECT * FROM conversations WHERE requester_id = ? ORDER BY updated_at DESC LIMIT 100', ctx.user!.id).map((c) => dto(c, false)) }))

  router.get('/api/conversations/:id', requireRole('customer', 'vendor'), (ctx) => dto(mine(ctx.params.id as string, ctx.user!.id), false))

  router.post('/api/conversations/:id/messages', requireRole('customer', 'vendor'), (ctx) => {
    const user = ctx.user!
    const { message } = parse({ message: newShape.message }, ctx.body)
    const wait = limiter.check(`conv-msg:${user.id}`, 30, 3_600_000)
    if (wait) throw tooMany(wait)
    return tx(db, () => {
      const c = mine(ctx.params.id as string, user.id)
      if (c.status === 'closed') throw conflict('closed', 'This conversation is closed. Start a new one.')
      run(db, 'INSERT INTO conversation_messages (id,conversation_id,sender,author_id,author_name,body,created_at) VALUES (?,?,?,?,?,?,?)', newId(), c.id, 'requester', user.id, user.name, message, now())
      run(db, "UPDATE conversations SET status = 'open', updated_at = ? WHERE id = ?", now(), c.id)
      return dto(get<ConvRow>(db, 'SELECT * FROM conversations WHERE id = ?', c.id) as ConvRow, false)
    })
  })

  router.post('/api/conversations/:id/close', requireRole('customer', 'vendor'), (ctx) => tx(db, () => {
    const c = mine(ctx.params.id as string, ctx.user!.id)
    run(db, "UPDATE conversations SET status = 'closed', updated_at = ? WHERE id = ?", now(), c.id)
    return dto(get<ConvRow>(db, 'SELECT * FROM conversations WHERE id = ?', c.id) as ConvRow, false)
  }))

  /* ------------------------------- Karta staff ---------------------------- */
  router.get('/api/admin/conversations', staffOnly, (ctx) => {
    const role = ctx.query.get('role'), status = ctx.query.get('status')
    const rows = all<ConvRow>(db, 'SELECT * FROM conversations ORDER BY updated_at DESC LIMIT 300')
      .filter((c) => (!role || c.requester_role === role) && (!status || c.status === status))
    return { conversations: rows.map((c) => dto(c, true)) }
  })

  router.get('/api/admin/conversations/:id', staffOnly, (ctx) => {
    const c = get<ConvRow>(db, 'SELECT * FROM conversations WHERE id = ?', ctx.params.id as string)
    if (!c) throw notFound('Conversation not found.')
    return dto(c, true)
  })

  router.post('/api/admin/conversations/:id/messages', staffOnly, (ctx) => {
    const b = parse({ message: newShape.message, internal: optional(bool()) }, ctx.body)
    return tx(db, () => {
      const c = get<ConvRow>(db, 'SELECT * FROM conversations WHERE id = ?', ctx.params.id as string)
      if (!c) throw notFound('Conversation not found.')
      run(db, 'INSERT INTO conversation_messages (id,conversation_id,sender,author_id,author_name,body,internal,created_at) VALUES (?,?,?,?,?,?,?,?)', newId(), c.id, 'staff', ctx.user!.id, 'Karta Support', b.message, b.internal ? 1 : 0, now())
      // A note to colleagues doesn't change whose turn it is.
      if (!b.internal) run(db, "UPDATE conversations SET status = CASE WHEN status = 'closed' THEN 'closed' ELSE 'pending' END, updated_at = ? WHERE id = ?", now(), c.id)
      return dto(get<ConvRow>(db, 'SELECT * FROM conversations WHERE id = ?', c.id) as ConvRow, true)
    })
  })

  router.post('/api/admin/conversations/:id/status', staffOnly, (ctx) => {
    const { status } = parse({ status: oneOf(STATUSES) }, ctx.body)
    return tx(db, () => {
      const c = get<ConvRow>(db, 'SELECT * FROM conversations WHERE id = ?', ctx.params.id as string)
      if (!c) throw notFound('Conversation not found.')
      run(db, 'UPDATE conversations SET status = ?, updated_at = ? WHERE id = ?', status, now(), c.id)
      audit(deps, ctx, { action: 'conversation.status', entityType: 'conversation', entityId: c.id, meta: { status } })
      return dto(get<ConvRow>(db, 'SELECT * FROM conversations WHERE id = ?', c.id) as ConvRow, true)
    })
  })

  /** Staff start a conversation with ONE customer or ONE vendor (e.g. to pass on or ask about a request). */
  router.post('/api/admin/conversations', staffOnly, (ctx) => {
    const b = parse({ ...newShape, requesterEmail: str({ min: 3, max: 254 }), requestId: optional(str({ max: 64 })) }, ctx.body)
    return tx(db, () => {
      const u = get<{ id: string; role: string }>(db, 'SELECT id,role FROM users WHERE email = ? AND deleted_at IS NULL', b.requesterEmail.toLowerCase())
      if (!u || (u.role !== 'customer' && u.role !== 'vendor')) throw unprocessable('requesterEmail', 'Choose a customer or a vendor.')
      if (b.requestId && !get(db, 'SELECT 1 AS x FROM custom_requests WHERE id = ?', b.requestId)) throw unprocessable('requestId', 'Request not found.')
      // A vendor's chat may mention a request, but is never linked to the customer behind it.
      const link = u.role === 'customer' ? b.requestId : undefined
      const id = newId()
      run(db, 'INSERT INTO conversations (id,number,requester_id,requester_role,request_id,subject,category,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)', id, nextNumber(), u.id, u.role, link, b.subject, b.category, 'pending', now(), now())
      run(db, 'INSERT INTO conversation_messages (id,conversation_id,sender,author_id,author_name,body,created_at) VALUES (?,?,?,?,?,?,?)', newId(), id, 'staff', ctx.user!.id, 'Karta Support', b.message, now())
      audit(deps, ctx, { action: 'conversation.started', entityType: 'conversation', entityId: id, meta: { with: u.role } })
      ctx.json(201, dto(get<ConvRow>(db, 'SELECT * FROM conversations WHERE id = ?', id) as ConvRow, true))
    })
  })
}
