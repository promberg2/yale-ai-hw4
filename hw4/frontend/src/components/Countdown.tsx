import { useEffect, useState } from "react";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [
    ["Days", Math.floor(s / 86400)],
    ["Hours", Math.floor((s % 86400) / 3600)],
    ["Min", Math.floor((s % 3600) / 60)],
    ["Sec", s % 60],
  ] as const;
}

export default function Countdown({ to, label }: { to: Date; label: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const left = to.getTime() - now;
  return (
    <div className="countdown" role="timer" aria-label={label}>
      {left > 0 ? (
        parts(left).map(([unit, value]) => (
          <div key={unit} className="countdown__cell">
            <b>{String(value).padStart(2, "0")}</b>
            <span>{unit}</span>
          </div>
        ))
      ) : (
        <div className="countdown__live">It's game day — Boola Boola!</div>
      )}
    </div>
  );
}
