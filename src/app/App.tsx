<<<<<<< HEAD
import { useEffect, type ReactNode } from 'react'
=======
import { useEffect } from 'react'
>>>>>>> c9c1a5b (Perfect the client dashboard and corresponing codes)
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

import VendorLayout from '@/modules/vendors/VendorLayout'
import VendorDashboardPage from '@/pages/vendor/VendorDashboardPage'
import VendorOnboardingPage from '@/pages/vendor/VendorOnboardingPage'
import VendorProductsPage from '@/pages/vendor/VendorProductsPage'
import VendorProductFormPage from '@/pages/vendor/VendorProductFormPage'
import VendorOrdersPage from '@/pages/vendor/VendorOrdersPage'
import VendorOrderDetailPage from '@/pages/vendor/VendorOrderDetailPage'
import VendorPayoutsPage from '@/pages/vendor/VendorPayoutsPage'
import VendorInsightsPage from '@/pages/vendor/VendorInsightsPage'
import VendorSettingsPage from '@/pages/vendor/VendorSettingsPage'

import LogisticsLayout from '@/modules/logistics/LogisticsLayout'
import LogisticsDashboardPage from '@/pages/logistics/LogisticsDashboardPage'
import LogisticsDeliveriesPage from '@/pages/logistics/LogisticsDeliveriesPage'
import LogisticsDeliveryDetailPage from '@/pages/logistics/LogisticsDeliveryDetailPage'

import VendorReviewsPage from '@/pages/vendor/VendorReviewsPage'

import AdminLayout from '@/modules/admin/AdminLayout'
import AdminDashboardPage from '@/pages/admin/AdminDashboardPage'
import AdminVendorsPage from '@/pages/admin/AdminVendorsPage'
import AdminVendorDetailPage from '@/pages/admin/AdminVendorDetailPage'
import AdminListingsPage from '@/pages/admin/AdminListingsPage'
import AdminReviewsPage from '@/pages/admin/AdminReviewsPage'
import AdminStaffPage from '@/pages/admin/AdminStaffPage'
import AdminDriverApplicationsPage from '@/pages/admin/AdminDriverApplicationsPage'
import ApplyLogisticsPage from '@/pages/auth/ApplyLogisticsPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import AccountReturnsPage from '@/pages/account/AccountReturnsPage'
import AccountReturnNewPage from '@/pages/account/AccountReturnNewPage'
import AccountReturnDetailPage from '@/pages/account/AccountReturnDetailPage'
import AccountSupportPage from '@/pages/account/AccountSupportPage'
import AccountSupportNewPage from '@/pages/account/AccountSupportNewPage'
import AccountSupportThreadPage from '@/pages/account/AccountSupportThreadPage'
import VendorReturnsPage from '@/pages/vendor/VendorReturnsPage'
import AdminReturnsPage from '@/pages/admin/AdminReturnsPage'
import AdminSupportPage from '@/pages/admin/AdminSupportPage'
import AdminRequestsPage from '@/pages/admin/AdminRequestsPage'
import VendorRequestsPage from '@/pages/vendor/VendorRequestsPage'
import RequestNewPage from '@/pages/requests/RequestNewPage'
import AccountRequestsPage from '@/pages/account/AccountRequestsPage'
import AccountRequestDetailPage from '@/pages/account/AccountRequestDetailPage'
import ChangePasswordPage from '@/pages/account/ChangePasswordPage'
import AccountSettingsPage from '@/pages/account/AccountSettingsPage'

import CheckoutPage from '@/pages/checkout/CheckoutPage'
import CheckoutReturnPage from '@/pages/checkout/CheckoutReturnPage'
import AccountOrdersPage from '@/pages/account/AccountOrdersPage'
import AccountOrderDetailPage from '@/pages/account/AccountOrderDetailPage'
import VendorProfilePage from '@/pages/public/VendorProfilePage'

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

<<<<<<< HEAD
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
=======
/**
 * Layout route that protects every child route with one RequireAuth.
 * Use it to guard a whole section (for example /account/*) once.
 */
function Guard({ roles }: { roles?: Role[] }) {
  return (
    <RequireAuth roles={roles}>
      <Outlet />
>>>>>>> c9c1a5b (Perfect the client dashboard and corresponing codes)
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
<<<<<<< HEAD

          {/* Checkout */}
=======

          {/* Apply to drive for Karta (verified by staff before any access) */}
          <Route path="apply/logistics" element={<ApplyLogisticsPage />} />

          {/* Request a custom piece (signed-in customers) */}
          <Route path="request" element={<RequireAuth><RequestNewPage /></RequireAuth>} />

          {/* Public vendor pages: ratings, reviews, recommendations */}
          <Route path="vendors/:id" element={<VendorProfilePage />} />

          {/* Checkout (signed-in customers) */}
>>>>>>> c9c1a5b (Perfect the client dashboard and corresponing codes)
          <Route
            path="checkout"
            element={
              <RequireAuth>
                <CheckoutPage />
              </RequireAuth>
            }
          />
<<<<<<< HEAD

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

=======
          <Route
            path="checkout/return"
            element={
              <RequireAuth>
                <CheckoutReturnPage />
              </RequireAuth>
            }
          />

          {/* Customer account: guarded once for every child */}
          <Route path="account" element={<Guard />}>
            <Route index element={<AccountHomePage />} />

            <Route path="settings" element={<AccountSettingsPage />} />
            <Route path="security" element={<ChangePasswordPage />} />
            <Route path="orders" element={<AccountOrdersPage />} />
            <Route path="orders/:id" element={<AccountOrderDetailPage />} />

            <Route path="requests" element={<AccountRequestsPage />} />
            <Route path="requests/:id" element={<AccountRequestDetailPage />} />

            <Route path="returns" element={<AccountReturnsPage />} />
            <Route path="returns/new" element={<AccountReturnNewPage />} />
            <Route path="returns/:id" element={<AccountReturnDetailPage />} />

            <Route path="support" element={<AccountSupportPage />} />
            <Route path="support/new" element={<AccountSupportNewPage />} />
            <Route path="support/:id" element={<AccountSupportThreadPage />} />

            {/* Old wishlist URL now lives at /wishlist */}
            <Route
              path="wishlist"
              element={<Navigate to="/wishlist" replace />}
            />

            <Route path="*" element={<Navigate to="/account" replace />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Vendor portal: own shell, guarded once for every child */}
        <Route
          path="vendor"
          element={
            <RequireAuth roles={['vendor', 'admin']}>
              <VendorLayout />
            </RequireAuth>
          }
        >
          <Route index element={<VendorDashboardPage />} />
          <Route path="onboarding" element={<VendorOnboardingPage />} />
          <Route path="products" element={<VendorProductsPage />} />
          <Route path="products/new" element={<VendorProductFormPage />} />
          <Route path="products/:id" element={<VendorProductFormPage />} />
          <Route path="orders" element={<VendorOrdersPage />} />
          <Route path="orders/:id" element={<VendorOrderDetailPage />} />
          <Route path="payouts" element={<VendorPayoutsPage />} />
          <Route path="reviews" element={<VendorReviewsPage />} />
          <Route path="returns" element={<VendorReturnsPage />} />
          <Route path="requests" element={<VendorRequestsPage />} />
          <Route path="insights" element={<VendorInsightsPage />} />
          <Route path="settings" element={<VendorSettingsPage />} />
          <Route path="*" element={<Navigate to="/vendor" replace />} />
        </Route>

        {/* Admin portal (staff only) */}
        <Route
          path="admin"
          element={
            <RequireAuth roles={['admin']}>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path="vendors" element={<AdminVendorsPage />} />
          <Route path="vendors/:email" element={<AdminVendorDetailPage />} />
          <Route path="listings" element={<AdminListingsPage />} />
          <Route path="reviews" element={<AdminReviewsPage />} />
          <Route path="returns" element={<AdminReturnsPage />} />
          <Route path="support" element={<AdminSupportPage />} />
          <Route path="requests" element={<AdminRequestsPage />} />
          <Route path="staff" element={<AdminStaffPage />} />
          <Route path="drivers/applications" element={<AdminDriverApplicationsPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>

        {/* Logistics portal */}
        <Route
          path="logistics"
          element={
            <RequireAuth roles={['logistics', 'admin']}>
              <LogisticsLayout />
            </RequireAuth>
          }
        >
          <Route index element={<LogisticsDashboardPage />} />
          <Route path="deliveries" element={<LogisticsDeliveriesPage />} />
          <Route path="deliveries/:id" element={<LogisticsDeliveryDetailPage />} />
          <Route path="*" element={<Navigate to="/logistics" replace />} />
        </Route>

>>>>>>> c9c1a5b (Perfect the client dashboard and corresponing codes)
        {/* Authentication */}
        <Route element={<AuthLayout />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
<<<<<<< HEAD
=======
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
>>>>>>> c9c1a5b (Perfect the client dashboard and corresponing codes)
        </Route>
      </Routes>
    </>
  )
}