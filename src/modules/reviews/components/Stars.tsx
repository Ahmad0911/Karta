import { useState } from 'react'
import { Star } from 'lucide-react'

/** Read-only stars with an accessible text alternative. */
export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const rounded = Math.round(value * 2) / 2

  return (
    <span role="img" aria-label={`${value.toFixed(1)} out of 5 stars`} className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = rounded >= n ? 1 : rounded >= n - 0.5 ? 0.5 : 0
        return (
          <span key={n} className="relative inline-block" style={{ width: size, height: size }}>
            <Star aria-hidden="true" width={size} height={size} className="absolute inset-0 text-[#151b1c]/15" />
            {fill > 0 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star aria-hidden="true" width={size} height={size} className="fill-[#b08a4a] text-[#b08a4a]" />
              </span>
            )}
          </span>
        )
      })}
    </span>
  )
}

const LABELS = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent']

/** Radio-group star picker: works with keyboard and screen readers. */
export function StarInput({
  value,
  onChange,
  name,
}: {
  value: number
  onChange: (n: number) => void
  name: string
}) {
  const [hover, setHover] = useState(0)
  const shown = hover || value

  return (
    <fieldset>
      <legend className="sr-only">Your rating</legend>
      <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className="cursor-pointer rounded p-0.5 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#bc8e63]"
            onMouseEnter={() => setHover(n)}
          >
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="sr-only"
              aria-label={`${n} star${n === 1 ? '' : 's'}: ${LABELS[n - 1]}`}
            />
            <Star
              aria-hidden="true"
              className={`h-8 w-8 transition ${shown >= n ? 'fill-[#b08a4a] text-[#b08a4a]' : 'text-[#151b1c]/20'}`}
            />
          </label>
        ))}
        <span className="ml-3 text-sm text-[#151b1c]/55" aria-live="polite">
          {shown ? LABELS[shown - 1] : 'Choose a rating'}
        </span>
      </div>
    </fieldset>
  )
}
