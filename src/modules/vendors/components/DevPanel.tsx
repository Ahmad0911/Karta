import { FlaskConical } from 'lucide-react'

import { toast } from '@/store/toast.store'
import { useVendor } from '../hooks/useVendor'
import { useVendorStore } from '../store/vendor.store'
import { secondaryBtn } from '@/components/portal/ui'

/**
 * Mock controls for the vendor flow. Rendered only in `npm run dev`
 * (tree-shaken from production builds). Delete once the API exists.
 */
export default function DevPanel() {
  const { email, workspace } = useVendor()
  const s = useVendorStore()

  if (!import.meta.env.DEV) return null

  const run = (label: string, fn: () => void) => () => {
    fn()
    toast.info(label)
  }

  return (
    <section
      aria-label="Developer mock controls"
      className="rounded-[1.25rem] border border-dashed border-[#8f7651]/50 bg-[#b79a6b]/[0.08] p-5"
    >
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8a6540]">
        <FlaskConical className="h-4 w-4" />
        Dev only · simulates what the Karta team and server will do
      </div>

      <p className="mt-2 text-xs leading-5 text-[#151b1c]/55">
        Current status: <strong>{workspace.profile.status.replace('_', ' ')}</strong>.
        Approvals now happen in the admin portal: sign in as <em>admin</em> (login page, dev
        shortcut) and open <strong>Vendor applications</strong>.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={secondaryBtn}
          onClick={run('Sample data loaded', () => s.devLoadDemoData(email))}
        >
          Load sample data
        </button>
        <button
          type="button"
          className={secondaryBtn}
          onClick={() => {
            if (window.confirm('Reset this vendor workspace?')) {
              s.devReset(email)
              toast.info('Workspace reset')
            }
          }}
        >
          Reset
        </button>
      </div>
    </section>
  )
}
