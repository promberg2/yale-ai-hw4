import { useEffect } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import BagDrawer from "./components/BagDrawer";
import ChatWidget from "./components/ChatWidget";
import Footer from "./components/Footer";
import Navbar from "./components/Navbar";
import About from "./pages/About";
import Account from "./pages/Account";
import { CreateAccount, Login } from "./pages/Auth";
import Checkout, { OrderConfirmation } from "./pages/Checkout";
import Home from "./pages/Home";
import ProductPage from "./pages/ProductPage";
import Products from "./pages/Products";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
}

function NotFound() {
  return (
    <section className="page-state container">
      <span className="eyebrow">404</span>
      <h1 className="display">This page wandered off campus.</h1>
      <Link to="/" className="btn btn--primary">
        Back to Home
      </Link>
    </section>
  );
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:id" element={<ProductPage />} />
          <Route path="/about" element={<About />} />
          <Route path="/login" element={<Login />} />
          <Route path="/create-account" element={<CreateAccount />} />
          <Route path="/account" element={<Account />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order/:number" element={<OrderConfirmation />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
      <BagDrawer />
      <ChatWidget />
    </>
  );
}
