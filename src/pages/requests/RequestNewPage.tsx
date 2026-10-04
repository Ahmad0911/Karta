import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ImagePlus, ShieldCheck, X } from 'lucide-react'

import { Card, FormField, Notice, PageHeader, inputClass, primaryBtn, secondaryBtn, textareaClass } from '@/components/portal/ui'
import VerificationPanel from '@/components/verification/VerificationPanel'
import { CHECKOUT_STATES } from '@/config/checkout'
import { categories } from '@/data/categories'
import { rooms } from '@/data/rooms'
import { prepareImage } from '@/lib/images'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { selectProfile, useProfileStore } from '@/modules/account/profile.store'
import { LIMITS, NEEDED_WITHIN, STYLES } from '@/modules/requests/lib'
import { useRequestsStore } from '@/modules/requests/requests.store'
import { useAuthStore } from '@/store/auth.store'
import { toast } from '@/store/toast.store'

const digits = (v: string) => v.replace(/\D/g, '')

export default function RequestNewPage() {
  useDocumentTitle('Request a piece')

  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)!
  const create = useRequestsStore((s) => s.create)
  const def = useProfileStore(selectProfile(user.email)).addresses.find((a) => a.isDefault)

  const [f, setF] = useState({ title: '', description: '', categoryId: '', room: '', dimensions: '', min: '', max: '', needed: '', city: def?.city ?? '', state: def?.state ?? '' })
  const [styles, setStyles] = useState<string[]>([])
  const [images, setImages] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  const set = (k: keyof typeof f) => (v: string) => { setF((p) => ({ ...p, [k]: v })); setError('') }

  const addImages = async (files: FileList | null) => {
    if (!files) return
    setBusy(true)
    const next = [...images]
    for (const x of Array.from(files)) {
      if (next.length >= LIMITS.maxImages) { toast.info(`You can add up to ${LIMITS.maxImages} images.`); break }
      const r = await prepareImage(x)
      if (r.ok) next.push(r.dataUrl); else toast.error(r.error)
    }
    setImages(next)
    setBusy(false)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const r = create({
      title: f.title, description: f.description, categoryId: f.categoryId || undefined, room: f.room || undefined,
      styles, dimensions: f.dimensions || undefined,
      budgetMin: f.min ? Number(f.min) : undefined, budgetMax: f.max ? Number(f.max) : undefined,
      neededWithinDays: f.needed ? Number(f.needed) : undefined, city: f.city, state: f.state, images,
    })
    if (!r.ok) return setError(r.error)
    toast.success('Request posted. Vendors can now make you offers.')
    navigate(`/account/requests/${r.data.id}`, { replace: true })
  }

  return (
    <main className="min-h-screen bg-[#f8f6f1] text-[#151b1c]">
      <div className="container-x max-w-3xl space-y-8 py-12 sm:py-16">
        <PageHeader eyebrow="Made for you" title="Request a piece." description="Can’t find what you imagine? Describe it or show us a photo. Verified vendors can offer to make it, with a price and a timeframe." />

        <p className="flex gap-3 rounded-2xl border border-[#8f7651]/25 bg-[#b79a6b]/[0.08] p-4 text-sm leading-6 text-[#151b1c]/70">
          <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[#8f7651]" />
          Vendors never see your phone or email. Keep all talking and payment inside Karta so you’re protected by our returns and refunds.
        </p>

        {!user.phoneVerified && (
          <Card className="space-y-3 border-[#b7791f]/30 p-5 sm:p-6">
            <h2 className="font-display text-xl">Verify your phone number first</h2>
            <p className="text-sm text-[#151b1c]/60">It helps vendors trust that real people are asking.</p>
            <VerificationPanel channels={['phone']} />
          </Card>
        )}

        <Card className="p-5 sm:p-7">
          <form onSubmit={submit} className="space-y-6" noValidate>
            <FormField id="q-title" label="What do you need?" required hint="For example: Curved walnut sofa in sand bouclé">
              <input id="q-title" className={inputClass()} maxLength={LIMITS.title[1]} value={f.title} aria-describedby="q-title-msg" onChange={(e) => set('title')(e.target.value)} />
            </FormField>

            <FormField id="q-desc" label="Describe it" required hint={`${f.description.trim().length}/${LIMITS.description[1]}. Size, materials, colours, how you will use it.`}>
              <textarea id="q-desc" className={textareaClass()} maxLength={LIMITS.description[1]} value={f.description} aria-describedby="q-desc-msg" onChange={(e) => set('description')(e.target.value)} />
            </FormField>

            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#151b1c]/55">Reference photos (optional)</p>
              <ul className="flex flex-wrap gap-3">
                {images.map((src, i) => (
                  <li key={i} className="relative">
                    <img src={src} alt={`Reference ${i + 1}`} className="h-24 w-24 rounded-xl object-cover" />
                    <button type="button" aria-label={`Remove reference ${i + 1}`} className="absolute -right-2 -top-2 rounded-full bg-[#151b1c] p-1.5 text-white" onClick={() => setImages(images.filter((_, n) => n !== i))}><X className="h-3.5 w-3.5" /></button>
                  </li>
                ))}
                {images.length < LIMITS.maxImages && <li><button type="button" disabled={busy} onClick={() => file.current?.click()} className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[#151b1c]/25 text-xs font-semibold text-[#151b1c]/55 hover:bg-white disabled:opacity-50"><ImagePlus className="h-5 w-5" />{busy ? '…' : 'Add'}</button></li>}
              </ul>
              <input ref={file} type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Upload reference photos" onChange={(e) => { void addImages(e.target.files); e.target.value = '' }} />
            </div>

            <fieldset>
              <legend className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#151b1c]/55">Style</legend>
              <div className="flex flex-wrap gap-2">
                {STYLES.map((s) => {
                  const on = styles.includes(s)
                  return (
                    <label key={s} className={`cursor-pointer rounded-full border px-4 py-2 text-xs font-medium transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#bc8e63] ${on ? 'border-[#151b1c] bg-[#151b1c] text-white' : 'border-[#151b1c]/15 hover:border-[#151b1c]/40'}`}>
                      <input type="checkbox" className="sr-only" checked={on} onChange={() => setStyles(on ? styles.filter((x) => x !== s) : [...styles, s])} />{s}
                    </label>
                  )
                })}
              </div>
            </fieldset>

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField id="q-cat" label="Category (optional)">
                <select id="q-cat" className={inputClass()} value={f.categoryId} onChange={(e) => set('categoryId')(e.target.value)}>
                  <option value="">Not sure</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </FormField>
              <FormField id="q-room" label="Room (optional)">
                <select id="q-room" className={inputClass()} value={f.room} onChange={(e) => set('room')(e.target.value)}>
                  <option value="">Not sure</option>{rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </FormField>
              <FormField id="q-dim" label="Size (optional)" hint="For example 220 × 95 × 80 cm">
                <input id="q-dim" className={inputClass()} value={f.dimensions} aria-describedby="q-dim-msg" onChange={(e) => set('dimensions')(e.target.value)} />
              </FormField>
              <FormField id="q-needed" label="When do you need it?">
                <select id="q-needed" className={inputClass()} value={f.needed} onChange={(e) => set('needed')(e.target.value)}>
                  {NEEDED_WITHIN.map((n) => <option key={n.label} value={n.days ?? ''}>{n.label}</option>)}
                </select>
              </FormField>
              <FormField id="q-min" label="Budget from (₦, optional)"><input id="q-min" inputMode="numeric" className={inputClass()} value={f.min} onChange={(e) => set('min')(digits(e.target.value))} /></FormField>
              <FormField id="q-max" label="Budget up to (₦, optional)"><input id="q-max" inputMode="numeric" className={inputClass()} value={f.max} onChange={(e) => set('max')(digits(e.target.value))} /></FormField>
              <FormField id="q-city" label="Deliver to: city or town" required><input id="q-city" className={inputClass()} value={f.city} onChange={(e) => set('city')(e.target.value)} /></FormField>
              <FormField id="q-state" label="State" required>
                <select id="q-state" className={inputClass()} value={f.state} onChange={(e) => set('state')(e.target.value)}>
                  <option value="">Select a state</option>{CHECKOUT_STATES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </FormField>
            </div>

            <Notice tone="info" title="How it works">
              A verified vendor who can make it sends you a price and how long it will take. The first vendor to offer takes the request, so no one else sees it. You can accept, or decline and the request opens again. You have 72 hours to answer.
            </Notice>

            {error && <p role="alert" className="text-sm text-[#9b302d]">{error}</p>}

            <div className="flex justify-end gap-2">
              <Link to="/account/requests" className={secondaryBtn}>Cancel</Link>
              <button className={primaryBtn} disabled={!user.phoneVerified}>Post my request</button>
            </div>
          </form>
        </Card>
      </div>
    </main>
  )
}
