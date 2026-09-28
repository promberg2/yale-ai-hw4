import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { CheckIcon, CrestMark } from "./Icons";

export default function Footer() {
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (/\S+@\S+\.\S+/.test(email)) setJoined(true);
  };

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__top">
          <div className="footer__brand">
            <div className="footer__logo">
              <CrestMark size={34} />
              <div>
                <div className="footer__name">Yale Bulldog Blue</div>
                <div className="footer__by">by Campus Customs · Est. 1975</div>
              </div>
            </div>
            <p className="footer__lede">
              Officially licensed Yale apparel, printed and embroidered next door to our original store on Broadway — for
              students, alumni, families, and every fan in between.
            </p>
          </div>

          <div className="footer__newsletter">
            <h3>Join the Bulldog Blue list</h3>
            <p>New arrivals, game-day drops, and reunion-season favorites — first.</p>
            {joined ? (
              <div className="footer__joined">
                <CheckIcon size={18} /> You're on the list. Boola Boola!
              </div>
            ) : (
              <form className="footer__form" onSubmit={submit}>
                <input
                  type="email"
                  placeholder="Your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-label="Email address"
                  required
                />
                <button className="btn btn--light" type="submit">
                  Subscribe
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="footer__grid">
          <div>
            <h4>Shop</h4>
            <Link to="/products?category=Hoodies">Hoodies</Link>
            <Link to="/products?category=Crewnecks">Crewnecks</Link>
            <Link to="/products?category=Tees%20%26%20Tops">Tees &amp; Tops</Link>
            <Link to="/products?category=Quarter-Zips">Quarter-Zips</Link>
            <Link to="/products?category=Jackets%20%26%20Fleece">Jackets &amp; Fleece</Link>
          </div>
          <div>
            <h4>Collections</h4>
            <Link to="/products?q=college">Residential Colleges</Link>
            <Link to="/products?q=school">Graduate &amp; Professional Schools</Link>
            <Link to="/products?q=sports">Yale Sports</Link>
            <Link to="/products?q=family">For the Family</Link>
          </div>
          <div>
            <h4>Company</h4>
            <Link to="/about">About Us</Link>
            <Link to="/login">Log in</Link>
            <Link to="/create-account">Create Account</Link>
          </div>
          <div>
            <h4>Visit</h4>
            <p>
              57 Broadway
              <br />
              New Haven, CT 06511
            </p>
            <p>Open 7 days a week</p>
            <a href="mailto:orderdept@campuscustoms.com">orderdept@campuscustoms.com</a>
          </div>
        </div>

        <div className="footer__bottom">
          <span>© {new Date().getFullYear()} Yale Bulldog Blue by Campus Customs.</span>
          <span className="footer__motto">Lux et Veritas</span>
        </div>
      </div>
    </footer>
  );
}
