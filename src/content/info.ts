
import type { InfoPageContent } from '@/components/ui/InfoPage'
import { COMPANY, POLICY } from '@/config/company'

/**
 * Copy for Karta's informational, support and editorial pages.
 *
 * IMPORTANT:
 * Privacy and Terms are working drafts, not legal advice.
 * Have a qualified Nigerian lawyer review them before launch.
 */

const UPDATED = 'Last updated 30 September 2026'

export type InfoSlug =
  | 'about'
  | 'careers'
  | 'shipping'
  | 'returns'
  | 'privacy'
  | 'terms'

export const INFO: Record<InfoSlug, InfoPageContent> = {
  // ========================================================================
  // ABOUT
  // ========================================================================

  about: {
    eyebrow: 'About Karta',
    title: 'A more considered way to furnish a home.',
    intro:
      'Karta is a curated marketplace for furniture and home living. We bring together makers worth knowing and pieces worth keeping, with a considered experience from discovery to delivery.',

    sections: [
      {
        id: 'why',
        heading: 'Why we started Karta',
        paragraphs: [
          'Buying furniture online should feel as reassuring as buying it in a showroom. You should know who made the piece, understand what you are buying, see the details clearly and know what happens after you place your order.',
          'Karta was created to bring that confidence to online furniture shopping. We bring together independent makers and established furniture businesses, while building the verification, fulfilment and customer support around the purchase.',
        ],
      },

      {
        id: 'how',
        heading: 'How Karta works',
        bullets: [
          'Vendors apply and are reviewed before their products become available on the marketplace.',
          'Browse by room, category, material or maker and explore useful details including dimensions, finishes and delivery estimates.',
          'Pay securely through Karta and select available delivery or professional assembly options where offered.',
          'Follow your order from confirmation through fulfilment and delivery, with support available if something does not go as expected.',
        ],
      },

      {
        id: 'makers',
        heading: 'For makers and sellers',
        paragraphs: [
          'Karta gives independent makers and established furniture houses a storefront designed to present their work properly, while providing the operational layer around orders, logistics, payments and customer support.',
          'Our aim is simple: give good furniture a better stage and give the people behind it a marketplace they can grow with.',
        ],
      },

      {
        id: 'customers',
        heading: 'For people who care about what they bring home',
        paragraphs: [
          'Furniture becomes part of the way a home feels. That is why Karta is designed around considered discovery rather than endless browsing — helping you find pieces that fit your space, your taste and the way you live.',
        ],
      },

      {
        id: 'company',
        heading: 'Who is behind Karta',
        paragraphs: [
          `Karta is operated by ${COMPANY.legalName}, based in ${COMPANY.location}.`,
        ],
      },
    ],

    cta: {
      title: 'Find something worth bringing home.',
      body:
        'Explore the collection by room, category or maker and discover pieces selected for considered spaces.',
      label: 'Explore the collection',
      to: '/shop',
    },

    related: [
      {
        label: 'Become a vendor',
        to: '/become-a-vendor',
      },
      {
        label: 'Contact us',
        to: '/contact',
      },
      {
        label: 'Careers',
        to: '/careers',
      },
    ],
  },

  // ========================================================================
  // CAREERS
  // ========================================================================

  careers: {
    eyebrow: 'Careers',
    title: 'Help us make furnishing a home feel effortless.',
    intro:
      'We are building a more trusted way to discover, buy and deliver furniture. There are no open roles listed right now, but we are always interested in hearing from thoughtful people who care about craft, design, technology and getting the details right.',

    sections: [
      {
        id: 'work',
        heading: 'The kind of work we do',
        bullets: [
          'Curating vendors, makers and pieces to a high standard.',
          'Building the marketplace, storefront and digital experience behind Karta.',
          'Developing vendor, order and logistics tools that make furniture commerce easier to manage.',
          'Supporting customers before, during and after delivery.',
          'Working with makers, delivery partners and assembly teams to create a dependable experience.',
        ],
      },

      {
        id: 'approach',
        heading: 'How we work',
        paragraphs: [
          'We care about the details customers notice and the systems they do not. That means thoughtful design, clear communication, dependable execution and a willingness to improve what is not working.',
        ],
      },

      {
        id: 'apply',
        heading: 'How to get in touch',
        paragraphs: [
          'Send us a short introduction: who you are, what you do best and what you would like to work on. Include a link to your work, portfolio or profile if you have one. We read every message.',
        ],
      },
    ],

    cta: {
      title: 'Introduce yourself.',
      body:
        'Tell us about you, what you do best and the kind of work you would like to contribute.',
      label: 'Send an introduction',
      to: '/contact?topic=careers',
    },

    related: [
      {
        label: 'About Karta',
        to: '/about',
      },
      {
        label: 'Become a vendor',
        to: '/become-a-vendor',
      },
    ],
  },

  // ========================================================================
  // SHIPPING
  // ========================================================================

  shipping: {
    eyebrow: 'Support',
    title: 'Shipping and delivery.',
    intro:
      'Furniture is large, valuable and needs care. Here is what to expect from the moment you place an order until your piece arrives at your door.',

    updated: UPDATED,

    sections: [
      {
        id: 'estimates',
        heading: 'Delivery estimates',
        paragraphs: [
          'Each piece displays its own delivery estimate on the product page. Ready-to-ship items may arrive sooner, while made-to-order, customised and larger pieces can require additional time.',
        ],
      },

      {
        id: 'cost',
        heading: 'Delivery cost',
        paragraphs: [
          'Delivery costs depend on your address, the size and characteristics of your order and the available delivery service. The applicable amount is shown at checkout before you pay.',
        ],
      },

      {
        id: 'tracking',
        heading: 'Tracking your order',
        paragraphs: [
          'Once your order is confirmed, you can follow its progress through your Karta account. If you checked out as a guest or cannot sign in, use the Track an Order page or contact us and we will help with an update.',
        ],
      },

      {
        id: 'assembly',
        heading: 'Professional assembly',
        paragraphs: [
          'Where professional assembly is available for a piece, you can add the service to your order. Our delivery team or assembly partner will complete the work at the agreed delivery point.',
        ],
      },

      {
        id: 'receiving',
        heading: 'When your order arrives',
        bullets: [
          'Inspect the packaging and the piece before the delivery team leaves whenever possible.',
          'Record any visible damage or issue on the delivery confirmation and contact Karta as soon as possible.',
          'Keep the original packaging until you are satisfied with the condition of the piece.',
          'If something does not look right, contact us before altering, repairing or disposing of the item or its packaging.',
        ],
      },
    ],

    cta: {
      title: 'Where is my order?',
      body:
        'Check the status of an order or contact us if you need an update.',
      label: 'Track an order',
      to: '/track-order',
    },

    related: [
      {
        label: 'Returns & refunds',
        to: '/returns',
      },
      {
        label: 'Help centre',
        to: '/help',
      },
      {
        label: 'Contact us',
        to: '/contact',
      },
    ],
  },

  // ========================================================================
  // RETURNS
  // ========================================================================

  returns: {
    eyebrow: 'Support',
    title: 'Returns and refunds.',
    intro:
      'If a piece arrives damaged, faulty or materially different from its description, contact us and we will help put things right. Here is how the process works.',

    updated: UPDATED,

    sections: [
      {
        id: 'window',
        heading: 'Your return window',
        paragraphs: [
          `Tell us within ${POLICY.returnWindowDays} days of delivery if there is a problem with your order. Contacting us as soon as you notice an issue helps us investigate and resolve it more quickly.`,
        ],
      },

      {
        id: 'eligible',
        heading: 'What we can return or refund',
        bullets: [
          'Pieces that arrive damaged or faulty.',
          'Pieces that are materially different from their description.',
          'Orders where the wrong piece was delivered.',
          'Other situations where a return or remedy is required under applicable consumer protection law.',
        ],
      },

      {
        id: 'not-eligible',
        heading: 'What we may not be able to accept',
        bullets: [
          'Pieces that have been used, altered or damaged after delivery.',
          'Made-to-order or customised pieces, unless they are faulty, damaged or materially different from their description.',
          'Items returned without prior agreement or the required return process being followed.',
        ],
      },

      {
        id: 'how',
        heading: 'How to start a return',
        paragraphs: [
          'Sign in and open your account to raise a return, or contact us with your order number, a short description of the issue and clear photographs where relevant. We will review the request, confirm the next step and arrange collection where appropriate.',
        ],
      },

      {
        id: 'refunds',
        heading: 'Refunds',
        paragraphs: [
          `Approved refunds are returned to your original payment method and usually take ${POLICY.refundProcessingDays} to reach you, depending on your bank or payment provider.`,
        ],
      },
    ],

    cta: {
      title: 'Need to return something?',
      body:
        'Tell us what happened and our support team will guide you through the next step.',
      label: 'Contact support',
      to: '/contact?topic=returns',
    },

    related: [
      {
        label: 'Shipping & delivery',
        to: '/shipping',
      },
      {
        label: 'Help centre',
        to: '/help',
      },
      {
        label: 'Terms',
        to: '/terms',
      },
    ],
  },

  // ========================================================================
  // PRIVACY
  // ========================================================================

  privacy: {
    eyebrow: 'Legal',
    title: 'Privacy policy.',
    intro: `This policy explains what personal information ${COMPANY.brand} collects, why we use it and the choices available to you. ${COMPANY.brand} is operated by ${COMPANY.legalName}.`,

    updated: UPDATED,

    sections: [
      {
        id: 'collect',
        heading: 'Information we collect',
        bullets: [
          'Account details such as your name, email address, phone number and password.',
          'Order details such as your delivery address, items purchased and order history.',
          'Payment confirmation from our payment providers. We do not store full card details.',
          'Messages and information you send to us, including customer support requests.',
          'Basic technical information such as device type, browser information and pages visited, where needed to keep the site secure, functional and improve the experience.',
        ],
      },

      {
        id: 'use',
        heading: 'How we use your information',
        bullets: [
          'To create and manage your account.',
          'To process, fulfil and deliver your orders.',
          'To provide customer support and handle returns or other service requests.',
          'To maintain marketplace security and help prevent fraud or abuse.',
          'To send updates or marketing communications you have requested, where applicable. You can unsubscribe from marketing communications at any time.',
          'To improve our website, marketplace, products and services.',
        ],
      },

      {
        id: 'share',
        heading: 'Who we share it with',
        paragraphs: [
          `We share only the information reasonably needed to provide our services with vendors fulfilling your order, delivery and assembly partners, technology or service providers supporting the platform, and payment providers (${POLICY.paymentProviders}). We do not sell your personal information.`,
        ],
      },

      {
        id: 'rights',
        heading: 'Your rights',
        paragraphs: [
          'Subject to applicable law, including the Nigeria Data Protection Act 2023, you may have rights to request access to, correction or deletion of your personal information, object to certain processing, and withdraw consent where processing is based on consent. You may also have the right to lodge a complaint with the Nigeria Data Protection Commission.',
        ],
      },

      {
        id: 'retention',
        heading: 'How long we keep information',
        paragraphs: [
          'We retain personal information only for as long as reasonably necessary for the purposes described in this policy and to meet applicable legal, regulatory, accounting or dispute-resolution obligations.',
        ],
      },

      {
        id: 'security',
        heading: 'Keeping your information secure',
        paragraphs: [
          'We use reasonable technical and organisational measures designed to protect information against unauthorised access, loss, misuse or alteration. No internet-based service can guarantee absolute security.',
        ],
      },

      {
        id: 'contact',
        heading: 'Contact',
        paragraphs: [
          `Questions or requests relating to your personal information can be sent to ${COMPANY.supportEmail}.`,
        ],
      },
    ],

    related: [
      {
        label: 'Terms',
        to: '/terms',
      },
      {
        label: 'Contact us',
        to: '/contact',
      },
    ],
  },

  // ========================================================================
  // TERMS
  // ========================================================================

  terms: {
    eyebrow: 'Legal',
    title: 'Terms of use.',
    intro: `These terms govern your use of ${COMPANY.brand}, operated by ${COMPANY.legalName}. By using the website or placing an order, you agree to these terms.`,

    updated: UPDATED,

    sections: [
      {
        id: 'marketplace',
        heading: 'How the marketplace works',
        paragraphs: [
          `${COMPANY.brand} is a marketplace connecting customers with independent furniture vendors. ${COMPANY.brand} provides the digital platform and may provide or coordinate payment processing, logistics, delivery, assembly and customer support.`,
        ],
      },

      {
        id: 'accounts',
        heading: 'Your account',
        paragraphs: [
          'Keep your sign-in details private and provide accurate information when creating or using an account. You are responsible for activity carried out through your account unless you notify us of unauthorised access.',
        ],
      },

      {
        id: 'orders',
        heading: 'Orders and pricing',
        paragraphs: [
          'Prices are displayed in Nigerian naira unless otherwise stated. An order is confirmed once the required payment has successfully been received. We may need to cancel an order where a piece becomes unavailable, a material listing error occurs or fulfilment is not possible. Where an order is cancelled after payment, applicable amounts will be refunded.',
        ],
      },

      {
        id: 'payments',
        heading: 'Payments',
        paragraphs: [
          `Payments are processed securely by ${POLICY.paymentProviders}. ${COMPANY.brand} does not store your full card details.`,
        ],
      },

      {
        id: 'delivery-returns',
        heading: 'Delivery and returns',
        paragraphs: [
          'Delivery, receiving and returns are described in our Shipping and Returns pages. Those policies form part of these terms and should be read together with them.',
        ],
      },

      {
        id: 'vendors',
        heading: 'Vendors',
        paragraphs: [
          'Vendors are responsible for providing accurate product information, maintaining appropriate stock information, meeting stated fulfilment expectations and complying with applicable laws and marketplace requirements. We may remove listings, restrict accounts or suspend vendors where our standards or applicable requirements are not met.',
        ],
      },

      {
        id: 'content',
        heading: 'Product information and images',
        paragraphs: [
          'We work to keep product descriptions, dimensions, images, materials, colours and other information accurate. Furniture is often made from natural or variable materials, so minor variations may occur. Where an important characteristic is materially different from the published information, contact us promptly so we can review it.',
        ],
      },

      {
        id: 'liability',
        heading: 'Liability',
        paragraphs: [
          'Nothing in these terms excludes or limits rights or remedies that cannot lawfully be excluded or limited under applicable Nigerian law. Subject to that, we are not responsible for indirect or consequential losses arising from use of the site to the extent permitted by law.',
        ],
      },

      {
        id: 'law',
        heading: 'Governing law',
        paragraphs: [
          'These terms are governed by the laws of the Federal Republic of Nigeria, subject to any mandatory consumer protection rights that apply.',
        ],
      },
    ],

    related: [
      {
        label: 'Privacy',
        to: '/privacy',
      },
      {
        label: 'Returns & refunds',
        to: '/returns',
      },
      {
        label: 'Shipping & delivery',
        to: '/shipping',
      },
    ],
  },
}