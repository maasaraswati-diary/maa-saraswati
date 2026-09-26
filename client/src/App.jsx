import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import EnquiryFab from './components/EnquiryFab';
import OfflineNotice from './components/OfflineNotice';
import { useAuth } from './context/AuthContext';
import { useReveal } from './hooks';

import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import About from './pages/About';
import Contact from './pages/Contact';
import NotFound from './pages/NotFound';

// The partner panel pulls in firebase/auth, so it loads only when someone visits
// it. That keeps the public storefront's bundle small.
const PartnerLogin = lazy(() => import('./pages/admin/PartnerLogin'));
const PartnerDashboard = lazy(() => import('./pages/admin/PartnerDashboard'));
const PartnerProductForm = lazy(() => import('./pages/admin/PartnerProductForm'));
const PartnerTestimonials = lazy(() => import('./pages/admin/PartnerTestimonials'));

function FullPageLoader() {
  return (
    <div className="loader" style={{ minHeight: '60vh' }}>
      <div className="loader-ring" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p className="muted">Loading…</p>
    </div>
  );
}

/** Sends visitors to the partner sign-in screen when not signed in. */
function RequirePartner({ children }) {
  const { user, ready, configured } = useAuth();
  if (!configured) return <FullPageLoader />;
  if (!ready) return <FullPageLoader />;
  if (!user) return <Navigate to="/partner" replace />;
  return children;
}

export default function App() {
  const location = useLocation();
  const isPartnerArea = location.pathname.startsWith('/partner');

  // Reveal animations re-scan after each route change.
  useReveal();

  useEffect(() => {
    if (!isPartnerArea) window.scrollTo(0, 0);
  }, [location.pathname, isPartnerArea]);

  return (
    <>
      <ScrollToTop />
      <Navbar />

      <main id="main">
        <Suspense fallback={<FullPageLoader />}>
          <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:slug" element={<ProductDetail />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />

          {/* Partner panel */}
          <Route path="/partner" element={<PartnerLogin />} />
          <Route
            path="/partner/products"
            element={
              <RequirePartner>
                <PartnerDashboard />
              </RequirePartner>
            }
          />
          <Route
            path="/partner/products/new"
            element={
              <RequirePartner>
                <PartnerProductForm />
              </RequirePartner>
            }
          />
          <Route
            path="/partner/products/:id"
            element={
              <RequirePartner>
                <PartnerProductForm />
              </RequirePartner>
            }
          />

          <Route
            path="/partner/testimonials"
            element={
              <RequirePartner>
                <PartnerTestimonials />
              </RequirePartner>
            }
          />

          {/* Old admin paths now point at the partner panel */}
          <Route path="/admin" element={<Navigate to="/partner" replace />} />
          <Route path="/admin/*" element={<Navigate to="/partner" replace />} />

          <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>

      {!isPartnerArea && <Footer />}
      {!isPartnerArea && <EnquiryFab />}
      {!isPartnerArea && <OfflineNotice />}
    </>
  );
}
