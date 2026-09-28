import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatPrice } from "../api";
import { useAuth } from "../context/AuthContext";
import { useBag } from "../context/BagContext";
import { useWishlist } from "../context/WishlistContext";
import { DEFAULT_CHECKOUT, formatMoney } from "../lib/account";
import FreeShippingBar from "./FreeShippingBar";
import { ArrowRight, BagIcon, CloseIcon, LockIcon, MinusIcon, PlusIcon } from "./Icons";

export default function BagDrawer() {
  const { items, isOpen, close, subtotal, count, updateQuantity, remove } = useBag();
  const { user } = useAuth();
  const { save } = useWishlist();
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const checkout = () => {
    close();
    navigate("/checkout");
  };

  return (
    <>
      <div className={`scrim ${isOpen ? "scrim--on" : ""}`} onClick={close} />
      <aside className={`drawer ${isOpen ? "drawer--open" : ""}`} aria-hidden={!isOpen} aria-label="Shopping bag">
        <div className="drawer__head">
          <h2>
            Your Bag <span>({count})</span>
          </h2>
          <button className="icon-btn" onClick={close} aria-label="Close bag">
            <CloseIcon />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="drawer__empty">
            <div className="drawer__empty-icon">
              <BagIcon size={30} />
            </div>
            <p>Your bag is empty.</p>
            <Link to="/products" className="btn btn--primary" onClick={close}>
              Shop the collection
            </Link>
            {user && (
              <Link to="/account?tab=wishlist" className="link-btn" onClick={close}>
                See your saved pieces
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="drawer__ship">
              <FreeShippingBar subtotal={subtotal} threshold={DEFAULT_CHECKOUT.free_shipping_threshold} />
            </div>
            <ul className="drawer__items">
              {items.map((item) => (
                <li key={`${item.productId}-${item.size}`} className="bag-item">
                  <Link to={`/products/${item.productId}`} onClick={close} className="bag-item__img">
                    <img src={item.imageUrl} alt={item.name} />
                  </Link>
                  <div className="bag-item__info">
                    <div className="bag-item__row">
                      <Link to={`/products/${item.productId}`} onClick={close} className="bag-item__name">
                        {item.name}
                      </Link>
                      <span>{formatPrice(item.price * item.quantity)}</span>
                    </div>
                    <span className="bag-item__size">
                      Size {item.size}
                      {item.maxQuantity <= 5 && <em> · only {item.maxQuantity} left</em>}
                    </span>
                    <div className="bag-item__row">
                      <div className="stepper stepper--sm">
                        <button onClick={() => updateQuantity(item.productId, item.size, item.quantity - 1)} aria-label="Decrease">
                          <MinusIcon size={14} />
                        </button>
                        <span>{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.productId, item.size, item.quantity + 1)} aria-label="Increase" disabled={item.quantity >= item.maxQuantity}>
                          <PlusIcon size={14} />
                        </button>
                      </div>
                      <span className="bag-item__links">
                        {user && (
                          <button
                            className="link-btn"
                            onClick={() => {
                              void save({ id: item.productId, name: item.name, image_url: item.imageUrl }, item.size);
                              remove(item.productId, item.size);
                            }}
                          >
                            Save for later
                          </button>
                        )}
                        <button className="link-btn" onClick={() => remove(item.productId, item.size)}>
                          Remove
                        </button>
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="drawer__foot">
              <div className="drawer__total">
                <span>Subtotal</span>
                <strong>{formatMoney(subtotal)}</strong>
              </div>
              <p className="drawer__note">
                {subtotal >= DEFAULT_CHECKOUT.free_shipping_threshold ? "Free shipping" : `Shipping ${formatMoney(DEFAULT_CHECKOUT.standard_shipping)}`} · free pickup at 57 Broadway · tax at checkout
              </p>
              <button className="btn btn--primary btn--block btn--lg" onClick={checkout}>
                <LockIcon size={17} /> Checkout <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
