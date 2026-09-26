import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import EnquiryFab from './components/EnquiryFab';
import { getToken } from './api';
import { useReveal } from './hooks';

import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import About from './pages/About';
import Contact from './pages/Contact';
import NotFound from './pages/NotFound';

import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import ProductForm from './pages/admin/ProductForm';

/** Sends unauthenticated visitors to the login screen. */
function RequireAdmin({ children }) {
  const location = useLocation();
  if (!getToken()) {
    return <Navigate to="/admin" replace state={{ from: location.pathname }} />;
  }
  return children;
}

export default function App() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  // Reveal animations re-scan after each route change.
  useReveal();

  useEffect(() => {
    if (!isAdmin) window.scrollTo(0, 0);
  }, [location.pathname, isAdmin]);

  return (
    <>
      <ScrollToTop />
      <Navbar />

      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:slug" element={<ProductDetail />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />

          <Route path="/admin" element={<AdminLogin />} />
          <Route
            path="/admin/dashboard"
            element={
              <RequireAdmin>
                <AdminDashboard />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/products/new"
            element={
              <RequireAdmin>
                <ProductForm />
              </RequireAdmin>
            }
          />
          <Route
            path="/admin/products/:id"
            element={
              <RequireAdmin>
                <ProductForm />
              </RequireAdmin>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      {!isAdmin && <Footer />}
      {!isAdmin && <EnquiryFab />}
    </>
  );
}
