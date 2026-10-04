
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import {
  ArrowUpRight,
  BadgeCheck,
  PackageCheck,
  Wallet,
} from 'lucide-react';

const BENEFITS = [
  [
    BadgeCheck,
    'Verified storefront',
    'Business, identity and banking checks before approval.',
  ],
  [
    PackageCheck,
    'Orders & inventory',
    'Manage catalogue, orders and fulfilment in one place.',
  ],
  [
    Wallet,
    'Clear settlements',
    'Track sales, fees and what is owed to your business.',
  ],
] as const;

export default function VendorStrip() {
  // Vendors go straight to their portal; everyone else learns about selling
  // first. (Linking to /register would create a *customer* account.)
  const role = useAuthStore((s) => s.user?.role);
  const isVendor = role === 'vendor' || role === 'admin' || role === 'super_admin';

  return (
    <section
      className="
        relative
        overflow-hidden
        border-y border-white/[0.06]
        bg-[#101E21]
        py-20
        text-[#f8f7f4]
        sm:py-28
        lg:py-32
      "
    >
      {/* ================================================================ */}
      {/* Ambient luxury detailing                                         */}
      {/* ================================================================ */}

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          -right-40
          -top-40
          h-[30rem]
          w-[30rem]
          rounded-full
          bg-[#b08a4a]/[0.055]
          blur-3xl
        "
      />

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          -bottom-48
          -left-40
          h-[26rem]
          w-[26rem]
          rounded-full
          bg-white/[0.025]
          blur-3xl
        "
      />

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          inset-x-0
          top-0
          h-px
          bg-gradient-to-r
          from-transparent
          via-[#b08a4a]/30
          to-transparent
        "
      />

      <div className="container-x relative">
        <div
          className="
            grid
            gap-14
            lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.85fr)]
            lg:items-center
            lg:gap-24
          "
        >
          {/* ============================================================ */}
          {/* Editorial introduction                                       */}
          {/* ============================================================ */}

          <div className="max-w-2xl">
            <div className="flex items-center gap-4">
              <span className="h-px w-10 bg-[#b08a4a]" />

              <p
                className="
                  text-[9px]
                  font-bold
                  uppercase
                  tracking-[0.3em]
                  text-[#c29a58]
                "
              >
                For furniture makers &amp; retailers
              </p>
            </div>

            <h2
              className="
                mt-7
                font-display
                text-[3rem]
                font-medium
                leading-[0.98]
                tracking-[-0.045em]
                text-[#f8f7f4]
                sm:text-6xl
                lg:text-[4.75rem]
              "
            >
              Your craft deserves
              <span
                className="
                  block
                  italic
                  text-white/[0.42]
                "
              >
                the right customers.
              </span>
            </h2>

            <p
              className="
                mt-7
                max-w-xl
                text-sm
                leading-7
                text-white/[0.52]
                sm:text-[0.95rem]
                sm:leading-8
              "
            >
              Bring your collection to Karta and reach customers who care
              about quality, design and dependable delivery.
            </p>

            {/* ======================================================== */}
            {/* CTA                                                        */}
            {/* ======================================================== */}

            <div className="mt-9">
              <Link
                to={isVendor ? '/vendor' : '/become-a-vendor'}
                className="
                  group
                  inline-flex
                  h-13
                  items-center
                  justify-center
                  gap-3
                  rounded-full
                  bg-[#f8f7f4]
                  px-6
                  text-[10px]
                  font-bold
                  uppercase
                  tracking-[0.18em]
                  text-[#101E21]
                  shadow-[0_15px_40px_rgba(0,0,0,0.18)]
                  transition-all
                  duration-500
                  hover:-translate-y-1
                  hover:bg-white
                  hover:shadow-[0_20px_50px_rgba(0,0,0,0.28)]
                "
              >
                {isVendor ? 'Open vendor portal' : 'Become a Karta vendor'}

                <span
                  className="
                    flex
                    h-6
                    w-6
                    items-center
                    justify-center
                    rounded-full
                    bg-[#101E21]/[0.07]
                    transition-transform
                    duration-500
                    group-hover:translate-x-0.5
                    group-hover:-translate-y-0.5
                  "
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </div>

            {/* Small editorial note */}
            <div
              className="
                mt-8
                flex
                items-center
                gap-3
                text-[9px]
                uppercase
                tracking-[0.2em]
                text-white/[0.28]
              "
            >
              <span className="h-1 w-1 rounded-full bg-[#b08a4a]" />
              Built for considered businesses
            </div>
          </div>

          {/* ============================================================ */}
          {/* Vendor benefits                                               */}
          {/* ============================================================ */}

          <div className="relative">
            {/* Vertical editorial line */}
            <div
              aria-hidden="true"
              className="
                absolute
                -left-6
                top-2
                bottom-2
                hidden
                w-px
                bg-gradient-to-b
                from-transparent
                via-white/[0.12]
                to-transparent
                lg:block
              "
            />

            <ul className="space-y-3">
              {BENEFITS.map(([Icon, title, body], index) => (
                <li
                  key={title}
                  className="
                    group
                    relative
                    overflow-hidden
                    rounded-[1.5rem]
                    border
                    border-white/[0.08]
                    bg-white/[0.035]
                    p-5
                    transition-all
                    duration-500
                    hover:-translate-y-0.5
                    hover:border-white/[0.15]
                    hover:bg-white/[0.055]
                    hover:shadow-[0_20px_50px_rgba(0,0,0,0.16)]
                    sm:p-6
                  "
                >
                  {/* Hover highlight */}
                  <span
                    aria-hidden="true"
                    className="
                      pointer-events-none
                      absolute
                      inset-y-0
                      left-0
                      w-px
                      bg-[#b08a4a]
                      opacity-0
                      transition-opacity
                      duration-500
                      group-hover:opacity-100
                    "
                  />

                  <div className="flex items-center gap-4 sm:gap-5">
                    {/* Icon */}
                    <span
                      className="
                        relative
                        flex
                        h-12
                        w-12
                        shrink-0
                        items-center
                        justify-center
                        rounded-full
                        border
                        border-[#b08a4a]/20
                        bg-[#b08a4a]/[0.08]
                        transition-all
                        duration-500
                        group-hover:border-[#b08a4a]/35
                        group-hover:bg-[#b08a4a]/[0.13]
                      "
                    >
                      <Icon
                        className="
                          h-[17px]
                          w-[17px]
                          text-[#c29a58]
                          transition-transform
                          duration-500
                          group-hover:scale-110
                        "
                      />
                    </span>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p
                          className="
                            text-sm
                            font-semibold
                            tracking-[-0.01em]
                            text-white/[0.9]
                          "
                        >
                          {title}
                        </p>

                        <span
                          className="
                            hidden
                            text-[8px]
                            font-bold
                            tracking-[0.18em]
                            text-white/[0.22]
                            sm:block
                          "
                        >
                          0{index + 1}
                        </span>
                      </div>

                      <p
                        className="
                          mt-1.5
                          max-w-md
                          text-[11px]
                          leading-5
                          text-white/[0.42]
                        "
                      >
                        {body}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ============================================================ */}
        {/* Bottom statement                                              */}
        {/* ============================================================ */}

        <div
          className="
            mt-16
            flex
            items-center
            gap-4
            border-t
            border-white/[0.07]
            pt-6
            sm:mt-20
          "
        >
          <span
            className="
              font-display
              text-lg
              italic
              text-white/[0.25]
            "
          >
            Karta
          </span>

          <span className="h-px flex-1 bg-white/[0.07]" />

          <span
            className="
              text-[8px]
              font-semibold
              uppercase
              tracking-[0.25em]
              text-white/[0.25]
            "
          >
            A better home for exceptional pieces
          </span>
        </div>
      </div>
    </section>
  );
}