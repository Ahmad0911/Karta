import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, Search, Sparkles, X } from 'lucide-react'

import { formatNaira } from '@/lib/format'
import { safeStorage } from '@/lib/safeStorage'
import { useCatalog } from '@/modules/catalog/useCatalog'
import { POPULAR_SEARCHES, suggest } from '@/modules/catalog/search'

const RECENT_KEY = 'karta:recent-searches'

const readRecent = (): string[] => {
  try { return (JSON.parse(safeStorage.getItem(RECENT_KEY) as string) as string[]).slice(0, 5) } catch { return [] }
}
const saveRecent = (q: string) => {
  const next = [q, ...readRecent().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 5)
  safeStorage.setItem(RECENT_KEY, JSON.stringify(next))
}

type Item = { key: string; label: string; hint?: string; to: string; kind: 'search' | 'category' | 'room' | 'product' | 'recent' | 'popular'; image?: string }

interface Props {
  /** Visual size: the slim desktop box, or the roomy one used in panels and on phones. */
  variant: 'slim' | 'roomy'
  autoFocus?: boolean
  onDone?: () => void
}

const INPUT = {
  slim: 'h-10 w-60 rounded-full border border-ink/[0.09] bg-white/45 pl-10 pr-9 text-[12px] text-ink outline-none transition-all duration-500 placeholder:text-ink/30 hover:border-ink/[0.15] hover:bg-white/70 focus:w-72 focus:border-ink/20 focus:bg-white focus:ring-4 focus:ring-ink/[0.025]',
  roomy: 'h-12 w-full rounded-full border border-ink/[0.09] bg-white pl-11 pr-10 text-sm text-ink outline-none transition-all placeholder:text-ink/30 focus:border-ink/20 focus:ring-4 focus:ring-ink/[0.025]',
}

/**
 * Search with live suggestions. Type two letters and see matching pieces, types and rooms.
 * Arrow keys move through the list, Enter opens the highlighted one (or searches), Escape closes it.
 */
export default function SearchBox({ variant, autoFocus, onDone }: Props) {
  const navigate = useNavigate()
  const { products } = useCatalog()
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const box = useRef<HTMLFormElement>(null)
  const listId = useId()

  const q = value.trim()

  const items = useMemo<Item[]>(() => {
    if (q.length < 2) {
      const recent = readRecent().map((r): Item => ({ key: `r:${r}`, label: r, to: `/shop?q=${encodeURIComponent(r)}`, kind: 'recent' }))
      const popular = POPULAR_SEARCHES.filter((p) => !recent.some((r) => r.label.toLowerCase() === p.toLowerCase())).slice(0, Math.max(3, 6 - recent.length))
        .map((p): Item => ({ key: `p:${p}`, label: p, to: `/shop?q=${encodeURIComponent(p)}`, kind: 'popular' }))
      return [...recent, ...popular]
    }
    const s = suggest(products, q, 5)
    return [
      { key: 'q', label: `Search for “${q}”`, to: `/shop?q=${encodeURIComponent(q)}`, kind: 'search' },
      ...s.categories.map((c): Item => ({ key: `c:${c.id}`, label: c.name, hint: 'Type', to: `/shop?category=${c.id}&q=${encodeURIComponent(q)}`, kind: 'category' })),
      ...s.rooms.map((r): Item => ({ key: `r:${r.id}`, label: r.name, hint: 'Room', to: `/shop?room=${r.id}&q=${encodeURIComponent(q)}`, kind: 'room' })),
      ...s.products.map((p): Item => ({ key: `i:${p.id}`, label: p.name, hint: formatNaira(p.price), to: `/product/${p.id}`, kind: 'product', image: p.image })),
    ]
  }, [q, products, open])

  useEffect(() => setActive(-1), [q])

  useEffect(() => {
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [])

  const go = (to: string, saveAs?: string) => {
    if (saveAs) saveRecent(saveAs)
    setOpen(false)
    navigate(to)
    onDone?.()
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const chosen = active >= 0 ? items[active] : undefined
    if (chosen) return go(chosen.to, chosen.kind === 'search' || chosen.kind === 'recent' || chosen.kind === 'popular' ? chosen.label.replace(/^Search for “|”$/g, '') : undefined)
    go(q ? `/shop?q=${encodeURIComponent(q)}` : '/shop', q || undefined)
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => (a + 1) % Math.max(items.length, 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a <= 0 ? items.length - 1 : a - 1)) }
    else if (e.key === 'Escape') { setOpen(false); setActive(-1) }
  }

  const icon = (k: Item['kind']) => (k === 'recent' ? <Clock className="h-3.5 w-3.5" /> : k === 'popular' ? <Sparkles className="h-3.5 w-3.5" /> : <Search className="h-3.5 w-3.5" />)

  return (
    <form ref={box} onSubmit={submit} role="search" className="relative">
      <Search className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink/30 ${variant === 'slim' ? 'left-4 h-[15px] w-[15px]' : 'left-4 h-4 w-4'}`} />
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => { setValue(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        placeholder="Search sofas, beds, “under 300k”…"
        aria-label="Search furniture and vendors"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        className={INPUT[variant]}
      />
      {value && (
        <button type="button" aria-label="Clear search" onClick={() => { setValue(''); setActive(-1) }} className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-ink/35 hover:bg-ink/[0.06] hover:text-ink">
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {open && items.length > 0 && (
        <div className={`absolute z-50 mt-2 overflow-hidden rounded-2xl border border-ink/[0.08] bg-white shadow-[0_24px_60px_-20px_rgba(21,27,28,0.28)] ${variant === 'slim' ? 'right-0 w-[22rem]' : 'left-0 right-0'}`}>
          {q.length < 2 && <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/35">{items.some((i) => i.kind === 'recent') ? 'Recent and popular' : 'Popular searches'}</p>}
          <ul id={listId} role="listbox" className="max-h-[22rem] overflow-y-auto py-1.5">
            {items.map((it, i) => (
              <li key={it.key} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(it.to, it.kind === 'search' ? q : it.kind === 'recent' || it.kind === 'popular' ? it.label : undefined)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] transition-colors ${i === active ? 'bg-ink/[0.045]' : ''}`}
                >
                  {it.kind === 'product' ? (
                    it.image ? <img src={it.image} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" /> : <span className="h-9 w-9 shrink-0 rounded-lg bg-ink/[0.06]" />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink/[0.04] text-ink/45">{icon(it.kind)}</span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-ink/85">{it.label}</span>
                  {it.hint && <span className="shrink-0 text-[11px] text-ink/40">{it.hint}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  )
}
