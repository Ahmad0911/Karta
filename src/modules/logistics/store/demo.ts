import type { Delivery, DeliveryEvent, DeliveryStatus } from '../types'
import { todayKey } from '../lib/deliveries'

/** DEV-only sample jobs. Ids are prefixed `demo_`. */

const ORDER: DeliveryStatus[] = [
  'assigned',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
]

const hoursAgo = (n: number) => new Date(Date.now() - n * 3_600_000).toISOString()

function events(status: DeliveryStatus, startedHoursAgo: number): DeliveryEvent[] {
  const reached =
    status === 'failed'
      ? ORDER.slice(0, 4)
      : ORDER.slice(0, ORDER.indexOf(status) + 1)

  const list: DeliveryEvent[] = reached.map((s, i) => ({
    status: s,
    at: hoursAgo(Math.max(0, startedHoursAgo - i * 1.5)),
  }))

  if (status === 'failed') {
    list.push({ status: 'failed', at: hoursAgo(0.5) })
  }

  return list
}

export function buildDemoDeliveries(): Delivery[] {
  const today = todayKey()

  const base = {
    pickupPhone: '08031234567',
    attempts: 0,
    scheduledFor: today,
  }

  return [
    {
      ...base,
      id: 'demo_d1',
      orderNumber: 'KRT-24101',
      status: 'assigned',
      vendorName: 'Ade & Sons Woodworks',
      pickupAddress: 'Plot 12, Industrial Layout, Kubwa, Abuja',
      customerName: 'Chidinma Okafor',
      customerPhone: '08052345678',
      dropoffAddress: '14 Gana Street, Maitama, Abuja',
      city: 'Abuja',
      state: 'FCT (Abuja)',
      items: ['Adaeze Bouclé Three-Seater Sofa × 1'],
      assemblyRequested: true,
      handlingNote: 'Bulky. Two people to carry. Light-coloured fabric: keep wrapped.',
      assignedAt: hoursAgo(3),
      deliveryCode: '4821',
      events: events('assigned', 3),
    },
    {
      ...base,
      id: 'demo_d2',
      orderNumber: 'KRT-24106',
      status: 'picked_up',
      vendorName: 'Nsukka Craft House',
      pickupAddress: '7 Craft Village Road, Gwarinpa, Abuja',
      customerName: 'Yusuf Mohammed',
      customerPhone: '08098765432',
      dropoffAddress: '3 Aminu Kano Crescent, Wuse 2, Abuja',
      city: 'Abuja',
      state: 'FCT (Abuja)',
      items: ['Oba Solid Oak Bed Frame, King × 1'],
      assemblyRequested: false,
      assignedAt: hoursAgo(6),
      deliveryCode: '7350',
      events: events('picked_up', 5),
    },
    {
      ...base,
      id: 'demo_d3',
      orderNumber: 'KRT-24105',
      status: 'out_for_delivery',
      vendorName: 'Ade & Sons Woodworks',
      pickupAddress: 'Plot 12, Industrial Layout, Kubwa, Abuja',
      customerName: 'Ngozi Eze',
      customerPhone: '07033221100',
      dropoffAddress: '22 Ibrahim Babangida Boulevard, Garki, Abuja',
      city: 'Abuja',
      state: 'FCT (Abuja)',
      items: ['Kano Six-Seater Dining Table × 1'],
      assemblyRequested: true,
      handlingNote: 'Table legs scratch easily. Pad before loading.',
      assignedAt: hoursAgo(9),
      deliveryCode: '1096',
      events: events('out_for_delivery', 8),
    },
    {
      ...base,
      id: 'demo_d4',
      orderNumber: 'KRT-24099',
      status: 'failed',
      attempts: 1,
      failureReason: 'customer_unreachable',
      failureNote: 'Called 3 times, no answer. Gate was locked.',
      vendorName: 'Zuri Interiors',
      pickupAddress: '5 Showroom Close, Jabi, Abuja',
      customerName: 'Amina Garba',
      customerPhone: '08111222333',
      dropoffAddress: '9 Lake View Estate, Lokogoma, Abuja',
      city: 'Abuja',
      state: 'FCT (Abuja)',
      items: ['Zuri Curved Lounge Chair × 2'],
      assemblyRequested: false,
      assignedAt: hoursAgo(12),
      deliveryCode: '5547',
      events: events('failed', 11),
    },
    {
      ...base,
      id: 'demo_d5',
      orderNumber: 'KRT-24093',
      status: 'delivered',
      attempts: 1,
      vendorName: 'Abuja Living Co.',
      pickupAddress: '18 Warehouse Road, Idu, Abuja',
      customerName: 'Folake Sanni',
      customerPhone: '08066554433',
      dropoffAddress: '41 Cadastral Zone, Life Camp, Abuja',
      city: 'Abuja',
      state: 'FCT (Abuja)',
      items: ['Halo Brass Floor Lamp × 1'],
      assemblyRequested: false,
      assignedAt: hoursAgo(30),
      deliveryCode: '2204',
      proof: {
        recipientName: 'Folake Sanni',
        note: 'Handed over at the gate. Checked and accepted.',
        deliveredAt: hoursAgo(20),
      },
      events: events('delivered', 28),
    },
  ]
}
