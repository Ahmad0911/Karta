
import InfoPage from '@/components/ui/InfoPage'
import { INFO, type InfoSlug } from '@/content/info'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

/**
 * ContentPage
 *
 * Renders Karta's informational / editorial pages from the central
 * `content/info.ts` content registry.
 *
 * Examples:
 *   /about
 *   /contact
 *   /privacy
 *   /terms
 *
 * The visual presentation is intentionally delegated to `InfoPage`
 * so every informational page maintains the same Karta luxury
 * design language.
 */
export default function ContentPage({
  slug,
}: {
  slug: InfoSlug
}) {
  const page = INFO[slug]

  /*
   * Keep the route resilient if a slug is ever introduced in the
   * router before its content is added to INFO.
   */
  if (!page) {
    useDocumentTitle('Page not found')

    return (
      <main className="min-h-[60vh] bg-[#f7f4ee] text-[#151b1c]">
        <div className="container-x flex min-h-[60vh] items-center justify-center py-20">
          <div className="max-w-md text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#8f7651]">
              Karta
            </p>

            <h1 className="mt-4 font-display text-4xl tracking-[-0.04em]">
              Page not found
            </h1>

            <p className="mt-4 text-sm leading-7 text-[#151b1c]/50">
              The page you are looking for is unavailable or may have moved.
            </p>
          </div>
        </div>
      </main>
    )
  }

  /*
   * Remove a trailing period from document titles so browser tabs
   * remain clean and consistent.
   */
  const documentTitle = page.title
    .replace(/\.$/, '')
    .trim()

  useDocumentTitle(`${documentTitle} | Karta`)

  return <InfoPage {...page} />
}