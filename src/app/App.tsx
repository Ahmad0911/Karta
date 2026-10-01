import { useEffect, type ReactNode } from 'react'
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'

import PublicLayout from '@/layouts/PublicLayout'
import AuthLayout from '@/layouts/AuthLayout'

import RequireAuth from '@/components/layout/RequireAuth'
import ComingSoon from '@/components/ui/ComingSoon'

import HomePage from '@/pages/public/HomePage'
import ShopPage from '@/pages/public/ShopPage'
import ProductPage from '@/pages/public/ProductPage'
import CartPage from '@/pages/public/CartPage'
import WishlistPage from '@/pages/public/WishlistPage'
import ContactPage from '@/pages/public/ContactPage'
import HelpPage from '@/pages/public/HelpPage'
import TrackOrderPage from '@/pages/public/TrackOrderPage'
import BecomeVendorPage from '@/pages/public/BecomeVendorPage'
import ContentPage from '@/pages/public/ContentPage'
import AccountHomePage from '@/pages/public/AccountHomePage'
import NotFoundPage from '@/pages/public/NotFoundPage'

import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'

import type { Role } from '@/types'

/* -------------------------------------------------------------------------- */
/* Scroll restoration                                                         */
/* -------------------------------------------------------------------------- */

function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    // Let in-page anchors (#section) scroll natively.
    if (window.location.hash) return

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])

  return null
}

/* -------------------------------------------------------------------------- */
/* Guards                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Layout route that protects every child route with one RequireAuth.
 * Use it to guard a whole section (for example /account/*) once.
 */
function Guard({ roles }: { roles?: Role[] }) {
  return (
    <RequireAuth roles={roles}>
      <Outlet />
    </RequireAuth>
  )
}

interface ProtectedPageProps {
  title: string
  note: string
  roles?: Role[]
}

/**
 * Temporary protected shell for modules that are still being built.
 * Replace only the `ComingSoon` element when the real page exists.
 */
function ProtectedPage({ title, note, roles }: ProtectedPageProps): ReactNode {
  return (
    <RequireAuth roles={roles}>
      <ComingSoon title={title} note={note} />
    </RequireAuth>
  )
}

/* -------------------------------------------------------------------------- */
/* Application                                                                */
/* -------------------------------------------------------------------------- */

export default function App() {
  return (
    <>
      <ScrollToTop />

      <Routes>
        <Route element={<PublicLayout />}>
          {/* Storefront */}
          <Route index element={<HomePage />} />
          <Route path="shop" element={<ShopPage />} />
          <Route path="product/:id" element={<ProductPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="wishlist" element={<WishlistPage />} />

          {/* Company */}
          <Route path="about" element={<ContentPage slug="about" />} />
          <Route path="careers" element={<ContentPage slug="careers" />} />
          <Route path="become-a-vendor" element={<BecomeVendorPage />} />

          {/* Support */}
          <Route path="help" element={<HelpPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="track-order" element={<TrackOrderPage />} />
          <Route path="shipping" element={<ContentPage slug="shipping" />} />
          <Route path="returns" element={<ContentPage slug="returns" />} />

          {/* Legal */}
          <Route path="privacy" element={<ContentPage slug="privacy" />} />
          <Route path="terms" element={<ContentPage slug="terms" />} />

          {/* Checkout */}
          <Route
            path="checkout"
            element={
              <ProtectedPage
                title="Checkout"
                note="Address, delivery method, assembly, Paystack/Flutterwave payment and order review (FR-CHECK, FR-PAY)."
              />
            }
          />

          {/* Customer account: guarded once for every child */}
          <Route path="account" element={<Guard />}>
            <Route index element={<AccountHomePage />} />

            <Route
              path="orders"
              element={
                <ComingSoon
                  title="My orders"
                  note="Order history and live delivery tracking (BRD §12)."
                />
              }
            />

            <Route
              path="returns"
              element={
                <ComingSoon
                  title="Returns & refunds"
                  note="Start a return and follow its progress (BRD §12)."
                />
              }
            />

            <Route
              path="support"
              element={
                <ComingSoon
                  title="Support"
                  note="Your support tickets and conversations with the Karta team (BRD §12)."
                />
              }
            />

            {/* Old wishlist URL now lives at /wishlist */}
            <Route
              path="wishlist"
              element={<Navigate to="/wishlist" replace />}
            />

            <Route path="*" element={<Navigate to="/account" replace />} />
          </Route>

          {/* Vendor */}
          <Route
            path="vendor/*"
            element={
              <ProtectedPage
                title="Vendor portal"
                note="Onboarding, products, inventory, orders, analytics and settlements (BRD §13)."
                roles={['vendor', 'admin']}
              />
            }
          />

          {/* Administration */}
          <Route
            path="admin/*"
            element={
              <ProtectedPage
                title="Admin control center"
                note="Vendor approval, product moderation, orders, finance, support and audit logs (BRD §16)."
                roles={['admin']}
              />
            }
          />

          {/* Logistics */}
          <Route
            path="logistics/*"
            element={
              <ProtectedPage
                title="Logistics"
                note="Delivery assignment, status updates and proof of delivery (BRD §14)."
                roles={['logistics', 'admin']}
              />
            }
          />

          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Authentication */}
        <Route element={<AuthLayout />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
        </Route>
      </Routes>
    </>
  )
}