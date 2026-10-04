
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import {
  ArrowUpRight,
  Check,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import HeroSlideshow from './HeroSlideshow';

export default function Hero() {
  const signedIn = useAuthStore((s) => Boolean(s.user));

  return (
    <section
      className="
        relative overflow-hidden
        border-b border-[#101E21]/[0.08]
        bg-[#f8f7f4]
      "
    >
      {/* ================================================================ */}
      {/* Ambient background detail                                       */}
      {/* ================================================================ */}

      <div
        aria-hidden
        className="
          pointer-events-none
          absolute
          -right-40
          -top-40
          h-[34rem]
          w-[34rem]
          rounded-full
          bg-[#b08a4a]/[0.055]
          blur-3xl
        "
      />

      <div
        aria-hidden
        className="
          pointer-events-none
          absolute
          -bottom-48
          -left-40
          h-[30rem]
          w-[30rem]
          rounded-full
          bg-[#101E21]/[0.035]
          blur-3xl
        "
      />

      <div
        className="
          container-x
          relative
          grid
          gap-14
          py-16
          sm:py-20
          lg:grid-cols-[0.9fr_1.1fr]
          lg:items-center
          lg:gap-16
          lg:py-24
          xl:gap-24
          xl:py-28
        "
      >
        {/* ============================================================ */}
        {/* Editorial copy                                                */}
        {/* ============================================================ */}

        <div className="animate-fade-up">
          {/* Eyebrow */}
          <div className="flex items-center gap-3">
            <span
              className="
                h-px
                w-8
                bg-[#9a7338]
              "
            />

            <p
              className="
                text-[9px]
                font-bold
                uppercase
                tracking-[0.3em]
                text-[#9a7338]
              "
            >
              Furniture &amp; home living
            </p>
          </div>

          <p
            className="
              mt-2
              pl-11
              text-[9px]
              uppercase
              tracking-[0.2em]
              text-[#101E21]/35
            "
          >
            Made for Nigeria
          </p>

          {/* Heading */}
          <h1
            className="
              mt-7
              max-w-3xl
              font-display
              text-[3.6rem]
              font-medium
              leading-[0.9]
              tracking-[-0.045em]
              text-[#101E21]
              sm:text-[5.4rem]
              lg:text-[5.5rem]
              xl:text-[6.5rem]
            "
          >
            Beautiful
            <span className="block">
              pieces.
            </span>

            <span
              className="
                mt-1
                block
                italic
                text-[#101E21]/40
              "
            >
              Without the guesswork.
            </span>
          </h1>

          {/* Description */}
          <p
            className="
              mt-8
              max-w-xl
              text-[0.98rem]
              leading-8
              text-[#101E21]/58
              sm:text-[1.02rem]
            "
          >
            Discover furniture from verified Nigerian vendors, shop with
            confidence, and follow every delivery to your door. Need it
            put together? We handle that too.
          </p>

          {/* ======================================================== */}
          {/* CTAs                                                       */}
          {/* ======================================================== */}

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/shop"
              className="
                group
                relative
                inline-flex
                h-13
                items-center
                justify-center
                gap-3
                overflow-hidden
                rounded-full
                bg-[#101E21]
                px-7
                text-[10px]
                font-bold
                uppercase
                tracking-[0.18em]
                text-white
                shadow-[0_14px_35px_rgba(16,30,33,0.15)]
                transition-all
                duration-500
                hover:-translate-y-0.5
                hover:bg-[#172b2f]
                hover:shadow-[0_20px_45px_rgba(16,30,33,0.20)]
              "
            >
              <span
                className="
                  absolute
                  inset-y-0
                  -left-1/2
                  w-1/3
                  skew-x-[-20deg]
                  bg-white/[0.08]
                  transition-transform
                  duration-700
                  group-hover:translate-x-[500%]
                "
              />

              <span className="relative">
                Explore the collection
              </span>

              <ArrowUpRight
                className="
                  relative
                  h-4
                  w-4
                  transition-transform
                  duration-300
                  group-hover:translate-x-0.5
                  group-hover:-translate-y-0.5
                "
              />
            </Link>

            <Link
              to={signedIn ? '/account' : '/register'}
              className="
                inline-flex
                h-13
                items-center
                justify-center
                rounded-full
                border
                border-[#101E21]/[0.14]
                bg-white/40
                px-7
                text-[10px]
                font-bold
                uppercase
                tracking-[0.18em]
                text-[#101E21]/70
                backdrop-blur-sm
                transition-all
                duration-300
                hover:border-[#101E21]/30
                hover:bg-white
                hover:text-[#101E21]
              "
            >
              {signedIn ? 'My account' : 'Create an account'}
            </Link>
          </div>

          {/* ======================================================== */}
          {/* Trust strip                                                */}
          {/* ======================================================== */}

          <div
            className="
              mt-11
              border-t
              border-[#101E21]/[0.08]
              pt-6
            "
          >
            <div className="flex flex-wrap gap-x-7 gap-y-4">
              {[
                'Verified vendors',
                'Tracked delivery',
                'Assembly available',
              ].map((item) => (
                <span
                  key={item}
                  className="
                    flex
                    items-center
                    gap-2.5
                    text-[10px]
                    font-medium
                    tracking-[0.01em]
                    text-[#101E21]/55
                  "
                >
                  <span
                    className="
                      flex
                      h-5
                      w-5
                      items-center
                      justify-center
                      rounded-full
                      bg-[#9a7338]/[0.10]
                    "
                  >
                    <Check
                      className="
                        h-3
                        w-3
                        text-[#9a7338]
                      "
                    />
                  </span>

                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* Hero imagery                                                  */}
        {/* ============================================================ */}

        <div
          className="
            relative
            animate-fade-up
            [animation-delay:120ms]
          "
        >
          {/* Decorative editorial number */}
          <div
            aria-hidden
            className="
              pointer-events-none
              absolute
              -right-2
              -top-10
              z-10
              hidden
              font-display
              text-[7rem]
              font-medium
              leading-none
              tracking-[-0.08em]
              text-[#101E21]/[0.035]
              lg:block
            "
          >
            01
          </div>

          {/* Main image */}
          <div
            className="
              relative
              overflow-hidden
              rounded-[2rem]
              bg-[#ebe8e1]
              shadow-[0_35px_90px_-35px_rgba(16,30,33,0.32)]
              sm:rounded-[2.5rem]
            "
          >
            <HeroSlideshow>
              {/* Cinematic overlay */}
              <div
                className="
                  absolute
                  inset-0
                  bg-gradient-to-t
                  from-[#101E21]/65
                  via-[#101E21]/5
                  to-transparent
                "
              />

              {/* Soft image wash */}
              <div
                className="
                  absolute
                  inset-0
                  bg-gradient-to-br
                  from-white/[0.08]
                  via-transparent
                  to-black/[0.06]
                "
              />

              {/* Karta mark */}
              <img
                src="/brand/karta-mark-light.png"
                alt=""
                aria-hidden
                className="
                  absolute
                  left-1/2
                  top-1/2
                  w-40
                  -translate-x-1/2
                  -translate-y-1/2
                  opacity-[0.075]
                  transition-transform
                  duration-[1200ms]
                  group-hover:scale-105
                "
              />

              {/* Image caption */}
              <div
                className="
                  absolute
                  bottom-7
                  left-7
                  right-7
                  sm:bottom-9
                  sm:left-9
                  sm:right-9
                "
              >
                <div className="flex items-center gap-3">
                  <Sparkles
                    className="
                      h-3.5
                      w-3.5
                      text-[#d6b77a]
                    "
                  />

                  <span
                    className="
                      text-[8px]
                      font-bold
                      uppercase
                      tracking-[0.28em]
                      text-white/60
                    "
                  >
                    The Karta collection
                  </span>
                </div>

                <p
                  className="
                    mt-3
                    max-w-sm
                    font-display
                    text-2xl
                    font-medium
                    leading-[1.08]
                    tracking-[-0.02em]
                    text-white
                    sm:text-[2rem]
                  "
                >
                  Pieces that make a room feel like home.
                </p>
              </div>
            </HeroSlideshow>
          </div>

          {/* ======================================================== */}
          {/* Verification card                                          */}
          {/* ======================================================== */}

          <div
            className="
              absolute
              -bottom-6
              left-5
              right-5
              z-10
              flex
              items-start
              gap-3.5
              rounded-[1.25rem]
              border
              border-white/70
              bg-[#f8f7f4]/[0.94]
              p-4
              shadow-[0_25px_65px_-28px_rgba(16,30,33,0.32)]
              backdrop-blur-xl
              sm:left-auto
              sm:right-6
              sm:w-[20rem]
              sm:p-5
            "
          >
            <span
              className="
                flex
                h-10
                w-10
                shrink-0
                items-center
                justify-center
                rounded-full
                bg-[#9a7338]/[0.10]
                text-[#9a7338]
              "
            >
              <ShieldCheck className="h-[18px] w-[18px]" />
            </span>

            <div>
              <div className="flex items-center gap-2">
                <p
                  className="
                    text-[11px]
                    font-bold
                    tracking-[-0.01em]
                    text-[#101E21]
                  "
                >
                  Verified before you buy.
                </p>

                <span
                  className="
                    h-1
                    w-1
                    rounded-full
                    bg-[#9a7338]
                  "
                />
              </div>

              <p
                className="
                  mt-1.5
                  text-[10px]
                  leading-5
                  text-[#101E21]/45
                "
              >
                Vendors are reviewed before their products appear on
                Karta.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
