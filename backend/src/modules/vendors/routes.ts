import type { Deps } from '../../deps.ts'
import { iso } from '../../platform/clock.ts'
import { newId } from '../../platform/crypto.ts'
import { all, get, run, tx } from '../../platform/db.ts'
import { badRequest, conflict, forbidden, invalid, notFound } from '../../platform/errors.ts'
import { requireRole, staffOnly, type Router } from '../../platform/http.ts'
import { array, bool, email, int, normalisePhone, object, oneOf, optional, parse, str } from '../../platform/validate.ts'
import { audit } from '../audit/audit.ts'
import { findUserById, type UserRow } from '../auth/users.ts'
import {
  DECISIONS, completenessErrors, emptyBusiness, emptyContact, emptyPayout, isEditable, overlaps,
  type Business, type Contact, type Decision, type Payout, type Status,
} from './rules.ts'

interface AppRow {
  id: string; user_id: string; status: Status; business: string; contact: string; payout: string; agreed_terms: number
  trust_score: number; review_note: string | null; submitted_at: string | null; decided_at: string | null; decided_by: string | null
  created_at: string; updated_at: string
  business_name_lc: string | null; phone_norm: string | null; bank_name: string | null; bank_account: string | null
}
interface DocRow { id: string; kind: string; file_name: string; content_type: string; size_kb: number; uploaded_at: string }

const DOC_KINDS = ['government_id', 'business_registration', 'proof_of_address', 'workshop_photo'] as const
const DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const

export function vendorRoutes(router: Router, deps: Deps) {
  const { db, clock } = deps
  const vendorOnly = requireRole('vendor')

  /* ------------------------------ helpers ---------------------------------- */
  const docsOf = (appId: string) => all<DocRow>(db, 'SELECT id,kind,file_name,content_type,size_kb,uploaded_at FROM vendor_documents WHERE application_id = ? ORDER BY uploaded_at', appId)
  const docKinds = (appId: string) => docsOf(appId).map((d) => ({ kind: d.kind, fileName: d.file_name }))
  const dto = (r: AppRow) => ({
    id: r.id, status: r.status, business: JSON.parse(r.business) as Business, contact: JSON.parse(r.contact) as Contact, payout: JSON.parse(r.payout) as Payout,
    agreedToTerms: r.agreed_terms === 1, trustScore: r.trust_score, reviewNote: r.review_note, submittedAt: r.submitted_at, decidedAt: r.decided_at,
    documents: docsOf(r.id).map((d) => ({ id: d.id, kind: d.kind, fileName: d.file_name, contentType: d.content_type, sizeKb: d.size_kb, uploadedAt: d.uploaded_at })),
  })
  const reload = (id: string) => get<AppRow>(db, 'SELECT * FROM vendor_applications WHERE id = ?', id) as AppRow

  function ownApplication(userId: string): AppRow {
    const existing = get<AppRow>(db, 'SELECT * FROM vendor_applications WHERE user_id = ?', userId)
    if (existing) return existing
    const u = findUserById(db, userId) as UserRow
    const now = iso(clock.now())
    run(db, `INSERT INTO vendor_applications (id,user_id,status,business,contact,payout,business_name_lc,phone_norm,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      newId(), userId, 'draft', JSON.stringify(emptyBusiness(u.business_name ?? '')), JSON.stringify(emptyContact(u.name, u.email, u.phone ?? '')), JSON.stringify(emptyPayout()),
      (u.business_name ?? '').toLowerCase(), u.phone_norm, now, now)
    return get<AppRow>(db, 'SELECT * FROM vendor_applications WHERE user_id = ?', userId) as AppRow
  }

  const log = (appId: string, by: string, action: string, note?: string) =>
    run(db, 'INSERT INTO vendor_application_log (application_id,at,by_user,action,note) VALUES (?,?,?,?,?)', appId, iso(clock.now()), by, action, note)

  /* ============================== Vendor side ============================== */

  router.get('/api/vendor/application', vendorOnly, (ctx) => ({ application: dto(ownApplication(ctx.user!.id)) }))

  // Partial update: send only what changed. Completeness is checked at submit.
  router.put('/api/vendor/application', vendorOnly, (ctx) => {
    const app = ownApplication(ctx.user!.id)
    if (!isEditable(app.status)) throw conflict('not_editable', 'This application can’t be edited right now.')

    const b = parse({
      business: optional(object({
        name: optional(str({ max: 120 })), type: optional(oneOf(['individual', 'registered'])), rcNumber: optional(str({ max: 40 })),
        description: optional(str({ max: 1500 })), categoryIds: optional(array(str({ max: 40 }), { max: 20 })),
        address: optional(str({ max: 200 })), city: optional(str({ max: 80 })), state: optional(str({ max: 40 })),
      })),
      contact: optional(object({ person: optional(str({ max: 80 })), phone: optional(str({ max: 30 })), whatsapp: optional(str({ max: 30 })), email: optional(email()) })),
      payout: optional(object({ bankName: optional(str({ max: 80 })), accountNumber: optional(str({ max: 20 })), accountName: optional(str({ max: 120 })) })),
      agreedToTerms: optional(bool()),
    }, ctx.body)

    const merge = <T extends object>(base: T, patch: Partial<T> | undefined): T => {
      const out = { ...base }
      for (const [k, v] of Object.entries(patch ?? {})) if (v !== undefined) (out as Record<string, unknown>)[k] = v
      return out
    }
    const business = merge(JSON.parse(app.business) as Business, b.business as Partial<Business> | undefined)
    const contact = merge(JSON.parse(app.contact) as Contact, b.contact as Partial<Contact> | undefined)
    const payout = merge(JSON.parse(app.payout) as Payout, b.payout as Partial<Payout> | undefined)

    run(db, `UPDATE vendor_applications SET business=?, contact=?, payout=?, agreed_terms=?, business_name_lc=?, phone_norm=?, bank_name=?, bank_account=?, updated_at=? WHERE id=?`,
      JSON.stringify(business), JSON.stringify(contact), JSON.stringify(payout), b.agreedToTerms === undefined ? app.agreed_terms : b.agreedToTerms ? 1 : 0,
      business.name.toLowerCase(), contact.phone ? normalisePhone(contact.phone) : null, payout.bankName || null, payout.accountNumber || null, iso(clock.now()), app.id)
    return { application: dto(reload(app.id)) }
  })

  // Metadata only for now. Phase 2 swaps this for signed uploads to private object storage.
  router.post('/api/vendor/application/documents', vendorOnly, (ctx) => {
    const app = ownApplication(ctx.user!.id)
    if (!isEditable(app.status)) throw conflict('not_editable', 'This application can’t be edited right now.')
    const b = parse({ kind: oneOf(DOC_KINDS), fileName: str({ min: 1, max: 200 }), contentType: oneOf(DOC_TYPES), sizeKb: int({ min: 1, max: 5120 }) }, ctx.body)

    run(db, `INSERT INTO vendor_documents (id,application_id,kind,file_name,content_type,size_kb,uploaded_at) VALUES (?,?,?,?,?,?,?)
             ON CONFLICT(application_id, kind) DO UPDATE SET id=excluded.id, file_name=excluded.file_name, content_type=excluded.content_type, size_kb=excluded.size_kb, uploaded_at=excluded.uploaded_at`,
      newId(), app.id, b.kind, b.fileName.replace(/[/\\]/g, '_'), b.contentType, b.sizeKb, iso(clock.now()))
    return ctx.json(201, { application: dto(app) })
  })

  router.delete('/api/vendor/application/documents/:id', vendorOnly, (ctx) => {
    const app = ownApplication(ctx.user!.id)
    if (!isEditable(app.status)) throw conflict('not_editable', 'This application can’t be edited right now.')
    run(db, 'DELETE FROM vendor_documents WHERE id = ? AND application_id = ?', ctx.params.id as string, app.id)
    ctx.json(204)
  })

  router.post('/api/vendor/application/submit', vendorOnly, (ctx) => {
    const user = findUserById(db, ctx.user!.id) as UserRow
    const appId = tx(db, () => {
      const app = ownApplication(user.id)
      if (!isEditable(app.status)) throw conflict('not_editable', 'This application has already been submitted.')

      const contact = JSON.parse(app.contact) as Contact
      const problems = completenessErrors(JSON.parse(app.business), contact, JSON.parse(app.payout), docKinds(app.id), app.agreed_terms === 1)
      if (Object.keys(problems).length) throw invalid(problems, 'Some sections still need your attention.')

      // Only people who proved they own their email and phone can apply.
      if (!user.email_verified_at || !user.phone_verified_at) throw badRequest('verification_required', 'Verify your email and phone number before submitting.')
      if (contact.email.trim().toLowerCase() !== user.email || normalisePhone(contact.phone) !== user.phone_norm) {
        throw badRequest('contact_mismatch', 'Use the email and phone number you verified, or verify the new ones first.')
      }

      run(db, `UPDATE vendor_applications SET status='under_review', review_note=NULL, submitted_at=?, updated_at=? WHERE id=?`, iso(clock.now()), iso(clock.now()), app.id)
      log(app.id, user.id, 'submitted')
      audit(deps, ctx, { action: 'vendor.application_submitted', entityType: 'vendor_application', entityId: app.id })
      return app.id
    })
    return { application: dto(reload(appId)) }
  })

  /* ============================== Admin side =============================== */

  router.get('/api/admin/vendor-applications', staffOnly, (ctx) => {
    const status = ctx.query.get('status')
    const q = (ctx.query.get('q') ?? '').trim().toLowerCase()
    const rows = all<AppRow & { email: string }>(db,
      `SELECT a.*, u.email FROM vendor_applications a JOIN users u ON u.id = a.user_id
       WHERE (? IS NULL OR a.status = ?) AND a.status != 'draft'
         AND (? = '' OR a.business_name_lc LIKE ? OR u.email LIKE ? OR a.phone_norm LIKE ?)
       ORDER BY COALESCE(a.submitted_at, a.created_at) ASC LIMIT 200`,
      status, status, q, `%${q}%`, `%${q}%`, `%${q}%`)
    return {
      applications: rows.map((r) => {
        const b = JSON.parse(r.business) as Business
        return { id: r.id, email: r.email, status: r.status, businessName: b.name, city: b.city, type: b.type, submittedAt: r.submitted_at }
      }),
    }
  })

  router.get('/api/admin/vendor-applications/:id', staffOnly, (ctx) => {
    const r = get<AppRow>(db, 'SELECT * FROM vendor_applications WHERE id = ?', ctx.params.id as string)
    if (!r || r.status === 'draft') throw notFound('Application not found.')
    const owner = findUserById(db, r.user_id) as UserRow
    return {
      application: dto(r),
      owner: { id: owner.id, email: owner.email, emailVerified: owner.email_verified_at !== null, phoneVerified: owner.phone_verified_at !== null },
      signals: signalsFor(r),
      history: all(db, 'SELECT l.at, l.action, l.note, u.email AS by FROM vendor_application_log l JOIN users u ON u.id = l.by_user WHERE l.application_id = ? ORDER BY l.id', r.id),
    }
  })

  router.post('/api/admin/vendor-applications/:id/decision', staffOnly, (ctx) => {
    const b = parse({ decision: oneOf(['approve', 'request_changes', 'reject', 'suspend', 'reinstate']), note: optional(str({ max: 1000 })), trustScore: optional(int({ min: 0, max: 100 })) }, ctx.body)
    const rule = DECISIONS[b.decision as Decision]

    tx(db, () => {
      const app = get<AppRow>(db, 'SELECT * FROM vendor_applications WHERE id = ?', ctx.params.id as string)
      if (!app || app.status === 'draft') throw notFound('Application not found.')
      if (!rule.from.includes(app.status)) throw conflict('invalid_transition', `A ${app.status.replace('_', ' ')} application can’t be ${rule.log}.`)
      if (rule.needsNote && (b.note ?? '').length < 10) throw invalid({ note: 'Add a clear note (at least 10 characters). The vendor will see it.' })

      if (b.decision === 'approve') {
        // Never approve an incomplete or unverified application, whatever the client says.
        const owner = findUserById(db, app.user_id) as UserRow
        const problems = completenessErrors(JSON.parse(app.business), JSON.parse(app.contact), JSON.parse(app.payout), docKinds(app.id), app.agreed_terms === 1)
        if (Object.keys(problems).length) throw invalid(problems, 'This application is incomplete and cannot be approved.')
        if (!owner.email_verified_at || !owner.phone_verified_at) throw badRequest('verification_required', 'The applicant hasn’t verified their email and phone.')
        if (owner.id === ctx.user!.id) throw forbidden('You can’t approve your own application.')
      }

      run(db, `UPDATE vendor_applications SET status=?, review_note=?, trust_score=?, decided_at=?, decided_by=?, updated_at=? WHERE id=?`,
        rule.to, b.decision === 'approve' || b.decision === 'reinstate' ? null : b.note ?? null, b.decision === 'approve' ? b.trustScore ?? 60 : app.trust_score,
        iso(clock.now()), ctx.user!.id, iso(clock.now()), app.id)
      log(app.id, ctx.user!.id, rule.log, b.note)
      audit(deps, ctx, { action: `vendor.${rule.log}`, entityType: 'vendor_application', entityId: app.id, meta: { from: app.status, to: rule.to } })
    })
    return { application: dto(reload(ctx.params.id as string)) }
  })

  /* Explainable warnings for the human reviewer. They never decide anything. */
  function signalsFor(app: AppRow) {
    const out: { level: 'warning' | 'info'; text: string }[] = []
    const b = JSON.parse(app.business) as Business
    const c = JSON.parse(app.contact) as Contact
    const p = JSON.parse(app.payout) as Payout

    if (p.accountName && !overlaps(p.accountName, b.name) && !overlaps(p.accountName, c.person)) {
      out.push({ level: 'warning', text: `Payout account name “${p.accountName}” doesn’t resemble the business name or contact person. Confirm the account belongs to them.` })
    }
    const label = (r: AppRow) => `“${(JSON.parse(r.business) as Business).name || 'unnamed'}” (${r.status.replace('_', ' ')})`

    if (app.phone_norm) {
      for (const o of all<AppRow>(db, 'SELECT * FROM vendor_applications WHERE phone_norm = ? AND id != ?', app.phone_norm, app.id)) {
        out.push({ level: 'warning', text: `Same phone number as ${label(o)}.` })
        if (o.status === 'rejected') out.push({ level: 'warning', text: 'A previously REJECTED application used this phone number.' })
      }
    }
    if (p.accountNumber) {
      for (const o of all<AppRow>(db, 'SELECT * FROM vendor_applications WHERE bank_name = ? AND bank_account = ? AND id != ?', p.bankName, p.accountNumber, app.id)) {
        out.push({ level: 'warning', text: `Same bank account as ${label(o)}.` })
      }
    }
    if (app.business_name_lc) {
      for (const o of all<AppRow>(db, 'SELECT * FROM vendor_applications WHERE business_name_lc = ? AND id != ?', app.business_name_lc, app.id)) {
        out.push({ level: 'info', text: `Same business name as ${label(o)}.` })
      }
    }
    if (b.type === 'registered' && !/^(RC|BN|IT)\s?\d{3,}$/i.test(b.rcNumber.trim())) out.push({ level: 'info', text: 'CAC number doesn’t look like RC/BN/IT followed by digits. Check it on the CAC public search.' })
    if (!docsOf(app.id).some((d) => d.kind === 'workshop_photo')) out.push({ level: 'info', text: 'No workshop or showroom photo was provided.' })
    return out
  }
}
