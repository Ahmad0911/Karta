// Run with KARTA_API=http://api.test/api and KARTA_DEV=0
const mem = new Map()
globalThis.window = { localStorage: { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: k => mem.delete(k) }, dispatchEvent: () => true, setTimeout }
globalThis.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o?.detail } }
let pass = 0, fail = 0
const ok = (n, c, x = '') => { if (c) { pass++; console.log('  ✓', n) } else { fail++; console.log('  ✗ FAIL:', n, x) } }

const calls = []
const listing = (id, over = {}) => ({ id, name: 'Walnut table', categoryId: 'tables', room: 'dining', material: 'Walnut', dimensions: '180 cm', colors: [{ name: 'Walnut', hex: '#5a3d2b' }], priceKobo: 45_000_000, originalPriceKobo: 50_000_000, stock: 3, deliveryMinDays: 5, deliveryMaxDays: 10, assemblyAvailable: true, images: ['https://res.cloudinary.com/x/a.jpg'], vendor: { id: 'v1', name: 'Ade Woodworks', trustScore: 72 }, custom: false, ...over })
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
globalThis.fetch = async (url) => {
  calls.push(String(url))
  if (String(url).includes('/catalog?')) return json(200, { total: 2, page: 1, pageSize: 100, listings: [listing('a'), listing('b', { stock: 0, originalPriceKobo: null, colors: [] })] })
  if (String(url).includes('/catalog/mine')) return json(200, listing('mine', { custom: true, priceKobo: 38_000_000 }))
  return json(404, { error: { code: 'not_found', message: 'Product not found.' } })
}

const { useRemoteCatalogStore, toProduct } = await import('@/modules/catalog/remote')
const S = () => useRemoteCatalogStore.getState()

console.log('\nCatalogue from the API')
await S().load()
ok('loads the products the server returns', S().status === 'ready' && S().products.length === 2)
ok('uses the batched page size', calls[0].includes('pageSize=100'))
const p = S().byId.a
ok('prices are converted from kobo to naira', p.price === 450000 && p.originalPrice === 500000)
ok('vendor name and trust score come from the server', p.vendor.name === 'Ade Woodworks' && p.vendor.trustScore === 72)
ok('delivery window, stock and photo map across', p.deliveryEstimateDays[0] === 5 && p.inStock === true && p.image.startsWith('https://res.cloudinary.com') && p.assemblyAvailable === true)
ok('out of stock and no discount are handled', S().byId.b.inStock === false && S().byId.b.originalPrice === undefined && S().byId.b.colors === undefined)
ok('demo seed products are NOT mixed in', !S().products.some(x => /^p\d+$/.test(x.id)))

console.log('\nMade-for-you pieces and deep links')
await S().fetchOne('mine')
ok('a single product can be fetched by id (private piece or direct link)', S().byId.mine?.price === 380000)
ok('…but it never appears in browsing', !S().products.some(x => x.id === 'mine'))
await S().fetchOne('ghost')
ok('an unknown product stays missing, quietly', S().byId.ghost === undefined)
const n = calls.length; await S().fetchOne('ghost'); await S().fetchOne('mine')
ok('lookups are not repeated', calls.length === n)
ok('toProduct is pure', toProduct(listing('z')).id === 'z')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
