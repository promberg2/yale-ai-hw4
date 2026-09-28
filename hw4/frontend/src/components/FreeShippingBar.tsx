import { formatMoney } from "../lib/account";
import { TruckIcon } from "./Icons";

export default function FreeShippingBar({ subtotal, threshold }: { subtotal: number; threshold: number }) {
  const left = Math.max(0, threshold - subtotal);
  const pct = Math.min(100, (subtotal / threshold) * 100);
  return (
    <div className={`ship-bar ${left === 0 ? "ship-bar--done" : ""}`}>
      <p>
        <TruckIcon size={16} />
        {left === 0 ? (
          <span>
            <strong>You have free shipping.</strong>
          </span>
        ) : (
          <span>
            You are <strong>{formatMoney(left)}</strong> away from free shipping.
          </span>
        )}
      </p>
      <div className="ship-bar__track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
