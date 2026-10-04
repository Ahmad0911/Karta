import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Pause, Play } from 'lucide-react'

import SafeImage from '@/components/ui/SafeImage'
import { IMAGES } from '@/data/images'

/** Rooms shown in the hero, in order. Add or remove entries freely. */
const SLIDES = [
  { src: IMAGES.hero, label: 'Living room' },
  { src: IMAGES.rooms.living, label: 'Lounge' },
  { src: IMAGES.rooms.bedroom, label: 'Bedroom' },
  { src: IMAGES.rooms.dining, label: 'Dining' },
  { src: IMAGES.rooms.office, label: 'Home office' },
  { src: IMAGES.rooms.outdoor, label: 'Outdoor' },
  { src: IMAGES.rooms.lighting, label: 'Lighting' },
] as const

const INTERVAL_MS = 5000

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Cross-fading hero images with a fixed write-up on top (`children`).
 *
 * Accessibility: the rotation stops for people who prefer reduced motion,
 * pauses while hovered/focused and while the tab is hidden, and there is a
 * visible pause button (WCAG 2.2.2). Screen readers are told only the current
 * slide; the slide change itself is not announced.
 */
export default function HeroSlideshow({ children }: { children?: ReactNode }) {
  const [index, setIndex] = useState(0)
  const [userPaused, setUserPaused] = useState(() => prefersReducedMotion())
  const [hovering, setHovering] = useState(false)
  const [hidden, setHidden] = useState(false)
  const timer = useRef<number>()

  const running = !userPaused && !hovering && !hidden

  const go = useCallback((i: number) => setIndex((i + SLIDES.length) % SLIDES.length), [])

  // Advance every 5 seconds while running. The timer restarts after any manual change.
  useEffect(() => {
    if (!running) return
    timer.current = window.setTimeout(() => go(index + 1), INTERVAL_MS)
    return () => window.clearTimeout(timer.current)
  }, [running, index, go])

  // Don't burn through slides while nobody is looking.
  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  return (
    <div
      className="relative h-[30rem] w-full sm:h-[38rem] lg:h-[43rem]"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
      role="group"
      aria-roledescription="carousel"
      aria-label="Rooms styled with Karta pieces"
    >
      {SLIDES.map((s, i) => (
        <div
          key={s.src}
          aria-hidden={i !== index}
          className={`absolute inset-0 transition-opacity duration-[1400ms] ease-in-out ${i === index ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        >
          <SafeImage
            src={s.src}
            alt={i === index ? `${s.label} styled with curated Karta furniture` : ''}
            fallback="bg-gradient-to-br from-ink-soft to-ink"
            className="h-full w-full"
            priority={i === 0}
          />
        </div>
      ))}

      {/* Readability wash so the write-up always sits on a calm surface. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/45 via-transparent to-black/10" />

      {/* Fixed write-up */}
      <div className="absolute inset-0 z-[2]">{children}</div>

      {/* Controls */}
      <div className="absolute right-4 top-4 z-[3] flex items-center gap-3 rounded-full bg-black/35 px-3 py-2 backdrop-blur-md sm:right-6 sm:top-6">
        <button
          type="button"
          onClick={() => setUserPaused((p) => !p)}
          aria-label={userPaused ? 'Play slideshow' : 'Pause slideshow'}
          className="text-white/90 transition hover:text-white"
        >
          {userPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
        </button>

        <div className="flex items-center gap-1.5" role="tablist" aria-label="Choose image">
          {SLIDES.map((s, i) => (
            <button
              key={s.label}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Show ${s.label}`}
              onClick={() => go(i)}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/45 hover:bg-white/75'}`}
            />
          ))}
        </div>
      </div>

      <p aria-live="off" className="absolute bottom-5 right-5 z-[3] hidden text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70 sm:block">
        {SLIDES[index].label}
      </p>
    </div>
  )
}
