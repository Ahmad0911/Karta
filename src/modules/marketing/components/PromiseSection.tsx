
const STEPS = [
  [
    'Discover & evaluate',
    'Browse curated listings and check each vendor’s trust score before you decide.',
  ],
  [
    'Purchase & pay',
    'Pay with Paystack, Flutterwave or transfer, verified server-side before your order is confirmed.',
  ],
  [
    'Track fulfilment',
    'Watch your order move from packed to dispatched to out for delivery.',
  ],
  [
    'Receive & confirm',
    'Confirm delivery by OTP, photo or signature, and add assembly if needed.',
  ],
  [
    'Review & get support',
    'Rate the vendor and product, or raise a ticket. A person picks it up.',
  ],
];

/** Mirrors BRD §27 customer journey. */
export default function PromiseSection() {
  return (
    <section
      id="promise"
      className="
        relative overflow-hidden
        border-y border-[#101E21]/[0.07]
        bg-[#f1eee7]
        py-20
        sm:py-28
        lg:py-32
      "
    >
      {/* ================================================================ */}
      {/* Decorative background detail                                     */}
      {/* ================================================================ */}

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          -right-40
          top-1/2
          h-[32rem]
          w-[32rem]
          -translate-y-1/2
          rounded-full
          border
          border-[#9a7338]/[0.08]
        "
      />

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          -right-24
          top-1/2
          h-[24rem]
          w-[24rem]
          -translate-y-1/2
          rounded-full
          border
          border-[#9a7338]/[0.06]
        "
      />

      <div className="container-x relative">
        {/* ============================================================ */}
        {/* Section introduction                                          */}
        {/* ============================================================ */}

        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <p
              className="
                text-[9px]
                font-bold
                uppercase
                tracking-[0.3em]
                text-[#9a7338]
              "
            >
              The Karta promise
            </p>

            <div className="mt-5 flex items-center gap-4">
              <span className="h-px w-10 bg-[#9a7338]/50" />

              <span
                className="
                  text-[9px]
                  font-semibold
                  uppercase
                  tracking-[0.2em]
                  text-[#101E21]/35
                "
              >
                A considered journey
              </span>
            </div>
          </div>

          <div>
            <h2
              className="
                max-w-4xl
                font-display
                text-[2.7rem]
                font-medium
                leading-[1.02]
                tracking-[-0.045em]
                text-[#101E21]
                sm:text-5xl
                lg:text-[4.5rem]
              "
            >
              From choosing a piece
              <span className="block italic text-[#101E21]/65">
                to settling into it.
              </span>
            </h2>

            <p
              className="
                mt-6
                max-w-xl
                text-sm
                leading-7
                text-[#101E21]/50
              "
            >
              Every stage is designed to make buying considered pieces
              feel clear, secure and beautifully uncomplicated.
            </p>
          </div>
        </div>

        {/* ============================================================ */}
        {/* Journey                                                        */}
        {/* ============================================================ */}

        <ol
          className="
            relative
            mt-14
            grid
            overflow-hidden
            rounded-[1.75rem]
            border
            border-[#101E21]/[0.09]
            bg-[#101E21]/[0.08]
            shadow-[0_25px_70px_-40px_rgba(16,30,33,0.28)]
            sm:mt-20
            sm:grid-cols-2
            lg:grid-cols-5
          "
        >
          {STEPS.map(([title, body], i) => (
            <li
              key={title}
              className="
                group
                relative
                flex
                min-h-[18rem]
                flex-col
                bg-[#f8f7f4]
                p-6
                transition-all
                duration-500
                hover:bg-white
                sm:p-7
                lg:min-h-[21rem]
                lg:p-7
                xl:p-8
              "
            >
              {/* ====================================================== */}
              {/* Step number                                               */}
              {/* ====================================================== */}

              <div className="flex items-start justify-between">
                <span
                  className="
                    font-display
                    text-[3.6rem]
                    font-medium
                    leading-none
                    tracking-[-0.05em]
                    text-[#9a7338]/25
                    transition-colors
                    duration-500
                    group-hover:text-[#9a7338]/55
                  "
                >
                  0{i + 1}
                </span>

                <span
                  className="
                    mt-1
                    flex
                    h-8
                    w-8
                    items-center
                    justify-center
                    rounded-full
                    border
                    border-[#101E21]/[0.09]
                    text-[9px]
                    text-[#101E21]/35
                    transition-all
                    duration-500
                    group-hover:border-[#9a7338]/30
                    group-hover:text-[#9a7338]
                  "
                >
                  →
                </span>
              </div>

              {/* ====================================================== */}
              {/* Step title                                                */}
              {/* ====================================================== */}

              <h3
                className="
                  mt-9
                  max-w-[13rem]
                  font-display
                  text-[1.2rem]
                  font-medium
                  leading-[1.2]
                  tracking-[-0.02em]
                  text-[#101E21]
                "
              >
                {title}
              </h3>

              {/* ====================================================== */}
              {/* Description                                               */}
              {/* ====================================================== */}

              <p
                className="
                  mt-4
                  max-w-[15rem]
                  text-[12.5px]
                  leading-6
                  text-[#101E21]/64
                "
              >
                {body}
              </p>

              {/* ====================================================== */}
              {/* Bottom progress marker                                    */}
              {/* ====================================================== */}

              <div className="mt-auto pt-8">
                <div
                  className="
                    h-px
                    w-8
                    bg-[#9a7338]/35
                    transition-all
                    duration-500
                    group-hover:w-full
                    group-hover:bg-[#9a7338]/60
                  "
                />
              </div>

              {/* ====================================================== */}
              {/* Desktop journey connector                               */}
              {/* ====================================================== */}

              {i < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className="
                    pointer-events-none
                    absolute
                    right-0
                    top-1/2
                    z-10
                    hidden
                    h-8
                    w-px
                    -translate-y-1/2
                    bg-[#101E21]/[0.10]
                    lg:block
                  "
                />
              )}
            </li>
          ))}
        </ol>

        {/* ============================================================ */}
        {/* Closing reassurance                                           */}
        {/* ============================================================ */}

        <div
          className="
            mt-8
            flex
            flex-col
            gap-3
            text-[9px]
            font-semibold
            uppercase
            tracking-[0.18em]
            text-[#101E21]/35
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          <span>Curated with intention</span>

          <span className="hidden h-px flex-1 bg-[#101E21]/[0.08] sm:block sm:max-w-[8rem]" />

          <span>Supported at every stage</span>
        </div>
      </div>
    </section>
  );
}
