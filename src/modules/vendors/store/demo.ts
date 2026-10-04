import { IMAGES } from '@/data/images'
import type {
  OrderEvent,
  OrderLine,
  OrderStatus,
  VendorListing,
  VendorOrder,
  VendorPayout,
} from '../types'

/**
 * DEV-only sample data so the vendor portal can be explored without a
 * backend. Ids are prefixed `demo_` so they are easy to find and remove.
 */

const daysAgo = (n: number, hour = 10) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(hour, 15, 0, 0)
  return d.toISOString()
}

const listing = (
  n: number,
  partial: Pick<
    VendorListing,
    'name' | 'categoryId' | 'room' | 'price' | 'stock' | 'status' | 'images'
  > &
    Partial<VendorListing>,
): VendorListing => ({
  id: `demo_l${n}`,
  sku: `KRT-DEMO-${String(n).padStart(3, '0')}`,
  description:
    'Handmade in our workshop from kiln-dried hardwood, finished by hand and checked piece by piece before it leaves for delivery.',
  material: 'Solid hardwood',
  dimensions: '180 × 90 × 75 cm',
  colors: [{ name: 'Natural', hex: '#C8A37A' }],
  deliveryMinDays: 5,
  deliveryMaxDays: 9,
  assemblyAvailable: true,
  createdAt: daysAgo(40),
  updatedAt: daysAgo(3),
  ...partial,
})

const LISTINGS: VendorListing[] = [
  listing(1, {
    name: 'Adaeze Bouclé Three-Seater Sofa',
    categoryId: 'sofas',
    room: 'living',
    price: 685000,
    originalPrice: 780000,
    stock: 6,
    status: 'live',
    images: [IMAGES.products.karta01],
  }),
  listing(2, {
    name: 'Oba Solid Oak Bed Frame, King',
    categoryId: 'beds',
    room: 'bedroom',
    price: 540000,
    stock: 2,
    status: 'live',
    images: [IMAGES.bedrooms.bedroom01],
  }),
  listing(3, {
    name: 'Kano Six-Seater Dining Table',
    categoryId: 'tables',
    room: 'dining',
    price: 420000,
    stock: 9,
    status: 'live',
    images: [IMAGES.dining.dining01],
  }),
  listing(4, {
    name: 'Zuri Curved Lounge Chair',
    categoryId: 'chairs',
    room: 'living',
    price: 185000,
    stock: 0,
    status: 'live',
    images: [IMAGES.products.karta02],
  }),
  listing(5, {
    name: 'Halo Brass Floor Lamp',
    categoryId: 'lighting',
    room: 'lighting',
    price: 96000,
    stock: 14,
    status: 'in_review',
    images: [IMAGES.products.karta05],
  }),
  listing(6, {
    name: 'Sahel Walnut Console Table',
    categoryId: 'tables',
    room: 'living',
    price: 245000,
    stock: 4,
    status: 'draft',
    images: [],
  }),
]

const price = (id: string) => LISTINGS.find((l) => l.id === id)!

const line = (listingId: string, qty = 1, assembly = false): OrderLine => ({
  listingId,
  name: price(listingId).name,
  qty,
  unitPrice: price(listingId).price,
  assembly,
})

const FLOW: OrderStatus[] = [
  'new',
  'confirmed',
  'packing',
  'ready_for_pickup',
  'with_logistics',
  'delivered',
]

function order(
  n: number,
  daysOld: number,
  customerLabel: string,
  city: string,
  state: string,
  lines: OrderLine[],
  status: OrderStatus,
  commission: (subtotal: number) => number,
  extra: Partial<VendorOrder> = {},
): VendorOrder {
  const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0)
  const fee = commission(subtotal)

  const reached =
    status === 'cancelled' ? FLOW.slice(0, 1) : FLOW.slice(0, FLOW.indexOf(status) + 1)

  const events: OrderEvent[] = reached.map((s, i) => ({
    status: s,
    at: daysAgo(Math.max(0, daysOld - i), 9 + i),
  }))

  if (status === 'cancelled') {
    events.push({
      status: 'cancelled',
      at: daysAgo(Math.max(0, daysOld - 1)),
      note: extra.cancelReason,
    })
  }

  return {
    id: `demo_o${n}`,
    number: `KRT-${24100 + n}`,
    customerLabel,
    city,
    state,
    lines,
    subtotal,
    commission: fee,
    netEarning: subtotal - fee,
    status,
    placedAt: daysAgo(daysOld),
    events,
    ...(status === 'delivered'
      ? { deliveredAt: daysAgo(Math.max(0, daysOld - 5)) }
      : {}),
    ...extra,
  }
}

export function buildDemoData(commission: (subtotal: number) => number) {
  const c = commission

  const orders: VendorOrder[] = [
    order(1, 0, 'Chidinma O.', 'Abuja', 'FCT (Abuja)', [line('demo_l1', 1, true)], 'new', c),
    order(2, 1, 'Tunde A.', 'Lagos', 'Lagos', [line('demo_l3')], 'new', c),
    order(3, 2, 'Halima B.', 'Kaduna', 'Kaduna', [line('demo_l2')], 'confirmed', c),
    order(4, 4, 'Emeka N.', 'Enugu', 'Enugu', [line('demo_l1'), line('demo_l4')], 'packing', c),
    order(5, 6, 'Ngozi E.', 'Port Harcourt', 'Rivers', [line('demo_l3', 1, true)], 'ready_for_pickup', c),
    order(6, 8, 'Yusuf M.', 'Abuja', 'FCT (Abuja)', [line('demo_l2')], 'with_logistics', c),
    order(7, 10, 'Folake S.', 'Ibadan', 'Oyo', [line('demo_l4', 2)], 'delivered', c),
    order(8, 17, 'Ifeanyi K.', 'Abuja', 'FCT (Abuja)', [line('demo_l1')], 'delivered', c, {
      payoutId: 'demo_p1',
    }),
    order(9, 21, 'Amina G.', 'Kano', 'Kano', [line('demo_l3'), line('demo_l5')], 'delivered', c, {
      payoutId: 'demo_p1',
    }),
    order(10, 12, 'Seyi D.', 'Lagos', 'Lagos', [line('demo_l4')], 'cancelled', c, {
      cancelReason: 'Item out of stock. Refund issued.',
    }),
  ]

  const paidOrders = orders.filter((o) => o.payoutId === 'demo_p1')

  const payouts: VendorPayout[] = [
    {
      id: 'demo_p1',
      reference: 'KRT-PAY-0007',
      amount: paidOrders.reduce((s, o) => s + o.netEarning, 0),
      orderIds: paidOrders.map((o) => o.id),
      paidAt: daysAgo(7, 15),
      bankLabel: 'GTBank ••••4821',
    },
  ]

  return { listings: LISTINGS, orders, payouts }
}
