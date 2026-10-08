import { useEffect } from "react";
import { Routes, Route, useLocation, Link } from "react-router-dom";
import Header from "./components/layout/Header";
import Footer from "./components/layout/Footer";
import HomePage from "./pages/HomePage";
import ServicesPage from "./pages/ServicesPage";
import AboutPage from "./pages/AboutPage";
import BookingPage from "./pages/BookingPage";
import PaymentPage from "./pages/PaymentPage";
import ConfirmationPage from "./pages/ConfirmationPage";
import ManagePage from "./pages/ManagePage";
import { BookingProvider } from "./context/BookingContext";
export default function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <BookingProvider>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      <main id="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/booking" element={<BookingPage />} />
          <Route path="/payment" element={<PaymentPage />} />
          <Route
            path="/confirmation/:reference"
            element={<ConfirmationPage />}
          />
          <Route path="/manage" element={<ManagePage />} />
          <Route
            path="*"
            element={
              <section className="container page-section">
                <h1 className="section-title">Page not found</h1>
                <Link to="/" className="text-link inline-block mt-6">
                  Return home
                </Link>
              </section>
            }
          />
        </Routes>
      </main>
      <Footer />
    </BookingProvider>
  );
}
