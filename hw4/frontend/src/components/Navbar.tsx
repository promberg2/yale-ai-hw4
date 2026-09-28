import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useBag } from "../context/BagContext";
import { useWishlist } from "../context/WishlistContext";
import { BagIcon, ChevronDown, CloseIcon, CrestMark, HeartIcon, MenuIcon, PackageIcon, UserIcon } from "./Icons";

const LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/products", label: "Products", end: false },
  { to: "/about", label: "About Us", end: false },
];

export default function Navbar() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { count, open } = useBag();
  const { user, logout } = useAuth();
  const { count: wishCount } = useWishlist();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bump, setBump] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  const overHero = pathname === "/" && !scrolled && !menuOpen;
  const firstName = user?.first_name || user?.name?.split(" ")[0] || "Account";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (count === 0) return;
    setBump(true);
    const t = setTimeout(() => setBump(false), 450);
    return () => clearTimeout(t);
  }, [count]);

  useEffect(() => setAccountOpen(false), [pathname, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) setAccountOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  const handleLogout = async () => {
    await logout();
    setAccountOpen(false);
    navigate("/");
  };

  return (
    <>
      <div className="announce">
        <div className="announce__track">
          <span>Officially licensed Yale apparel</span>
          <span className="announce__dot" />
          <span>Family-owned on Broadway since 1975</span>
          <span className="announce__dot" />
          <span>Visit us at 57 Broadway, New Haven</span>
        </div>
      </div>

      <header className={`nav ${overHero ? "nav--hero" : "nav--solid"} ${scrolled ? "nav--scrolled" : ""}`}>
        <div className="nav__inner container">
          <Link to="/" className="brand" aria-label="Yale Bulldog Blue home">
            <CrestMark size={26} />
            <span className="brand__text">
              <span className="brand__name">Bulldog Blue</span>
              <span className="brand__sub">by Campus Customs</span>
            </span>
          </Link>

          <nav className="nav__links" aria-label="Primary">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className="nav__link">
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="nav__actions">
            {user ? (
              <div className="account" ref={accountRef}>
                <button
                  className="nav__link nav__account"
                  onClick={() => setAccountOpen((v) => !v)}
                  aria-expanded={accountOpen}
                  aria-haspopup="menu"
                >
                  <span className="account__avatar">{firstName.charAt(0).toUpperCase()}</span>
                  <span className="nav__account-name">{firstName}</span>
                  <ChevronDown size={15} />
                </button>
                <div className={`account__menu ${accountOpen ? "account__menu--open" : ""}`} role="menu">
                  <div className="account__head">
                    <span>Signed in as</span>
                    <strong>{user.email}</strong>
                  </div>
                  <Link to="/account" className="account__item" role="menuitem">
                    <UserIcon size={16} /> My account
                  </Link>
                  <Link to="/account?tab=wishlist" className="account__item" role="menuitem">
                    <HeartIcon size={16} /> Wishlist {wishCount > 0 && <em>{wishCount}</em>}
                  </Link>
                  <Link to="/account?tab=orders" className="account__item" role="menuitem">
                    <PackageIcon size={16} /> Orders
                  </Link>
                  <button className="account__item account__item--muted" onClick={handleLogout} role="menuitem">
                    Log out
                  </button>
                </div>
              </div>
            ) : (
              <>
                <NavLink to="/login" className="nav__link nav__login">
                  <UserIcon size={18} />
                  <span>Log in</span>
                </NavLink>
                <Link to="/create-account" className="btn btn--pill nav__cta" aria-label="Create Account">
                  <span className="nav__cta-long">Create Account</span>
                  <span className="nav__cta-short">Sign up</span>
                </Link>
              </>
            )}
            <button className={`icon-btn bag-btn ${bump ? "bag-btn--bump" : ""}`} onClick={open} aria-label={`Open bag, ${count} items`}>
              <BagIcon size={21} />
              {count > 0 && <span className="bag-btn__count">{count}</span>}
            </button>
            <button className="icon-btn nav__burger" onClick={() => setMenuOpen((v) => !v)} aria-label="Toggle menu" aria-expanded={menuOpen}>
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>

        <div className={`mobile-menu ${menuOpen ? "mobile-menu--open" : ""}`}>
          {[
            ...LINKS,
            ...(user ? [{ to: "/account", label: "My Account", end: false }] : [{ to: "/login", label: "Log in", end: false }, { to: "/create-account", label: "Create Account", end: false }]),
          ].map((l, i) => (
            <NavLink key={l.to} to={l.to} end={l.end} className="mobile-menu__link" style={{ transitionDelay: `${menuOpen ? 60 + i * 50 : 0}ms` }}>
              {l.label}
            </NavLink>
          ))}
          {user && (
            <button className="mobile-menu__link mobile-menu__link--btn" onClick={handleLogout}>
              Log out ({firstName})
            </button>
          )}
        </div>
      </header>
    </>
  );
}
