import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Link } from "react-router-dom";
import { displayName, formatPrice, type ProductSummary } from "../api";
import { swatch, titleCase } from "../lib/colors";
import type { Campaign, Weather } from "../lib/season";
import { ArrowLeft, ArrowRight } from "./Icons";
import WishlistButton from "./WishlistButton";

const SLIDE_MS = 5600;

const WORD: Record<string, string> = {
  Hoodies: "Hoodie",
  Crewnecks: "Crewneck",
  "Tees & Tops": "Tee",
  "Quarter-Zips": "Quarter-Zip",
  "Jackets & Fleece": "Outerwear",
};

interface Props {
  campaign: Campaign;
  slides: ProductSummary[];
  loading: boolean;
  weather: Weather | null;
  daysToGame: number;
}

export default function SeasonHero({ campaign, slides, loading, weather, daysToGame }: Props) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [cycle, setCycle] = useState(0);
  const swipeX = useRef<number | null>(null);
  const reduced = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const n = slides.length;

  useEffect(() => setActive(0), [campaign.key]);

  const go = (i: number) => {
    if (!n) return;
    setActive(((i % n) + n) % n);
    setCycle((c) => c + 1);
  };

  const onPointerDown = (e: PointerEvent) => {
    swipeX.current = e.clientX;
  };
  const onPointerUp = (e: PointerEvent) => {
    if (swipeX.current === null) return;
    const dx = e.clientX - swipeX.current;
    swipeX.current = null;
    if (Math.abs(dx) > 48) go(active + (dx < 0 ? 1 : -1));
  };

  const current = slides[active];
  const showGame = daysToGame > 0 && daysToGame <= 75;

  return (
    <section className={`shero shero--${campaign.key}`}>
      <div className="shero__bg" />
      <div className="hero__grain" />
      <Ambient kind={campaign.ambient} reduced={reduced} />

      <div className="container shero__inner">
        <div className="shero__copy">
          <div className="shero__chips">
            {weather?.live && (
              <span className="shero__chip">
                <i className="shero__live" />
                <span>
                  {weather.tempF}°F · {weather.condition}
                  <span className="shero__chip-long"> in New Haven</span>
                </span>
              </span>
            )}
            {showGame && (
              <Link to="/products?q=football" className="shero__chip shero__chip--game">
                🏈 The Game in {daysToGame} {daysToGame === 1 ? "day" : "days"}
              </Link>
            )}
          </div>

          <span className="eyebrow eyebrow--light shero__eyebrow">
            <span className="eyebrow__line" /> {campaign.eyebrow}
          </span>
          <h1 className="shero__title" key={campaign.key}>
            <span className="hero__line">{campaign.title[0]}</span>
            <span className="hero__line hero__line--italic">{campaign.title[1]}</span>
          </h1>
          <p className="shero__lede">{campaign.lede}</p>
          <div className="shero__ctas">
            <Link to={campaign.cta.to} className="btn btn--light btn--lg">
              {campaign.cta.label} <ArrowRight size={18} />
            </Link>
            <Link to={campaign.secondary.to} className="btn btn--ghost-light btn--lg">
              {campaign.secondary.label}
            </Link>
          </div>

          {n > 0 && (
            <div className="shero__picks">
              <span className="shero__picks-label">The {campaign.key === "fall" ? "fall" : "season's"} edit · {n} picks</span>
              <div className="shero__thumbs">
                {slides.map((p, i) => (
                  <button
                    key={p.id}
                    className={`shero__thumb ${i === active ? "shero__thumb--on" : ""}`}
                    onClick={() => go(i)}
                    aria-label={`Show ${p.name}`}
                    aria-current={i === active}
                  >
                    <img src={p.image_url} alt="" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div
          className={`spot ${paused ? "spot--paused" : ""}`}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          aria-roledescription="carousel"
          aria-label={`${campaign.eyebrow} spotlight`}
        >
          <div className="spot__arch">
            {loading || !current ? (
              <div className="spot__loading shimmer" />
            ) : (
              <>
                <span className="spot__word" key={`w-${current.id}`} aria-hidden="true">
                  {WORD[current.category] ?? "Yale"}
                </span>
                {slides.map((p, i) => (
                  <Link
                    key={p.id}
                    to={`/products/${p.id}`}
                    className={`spot__slide ${i === active ? "spot__slide--on" : ""}`}
                    tabIndex={i === active ? 0 : -1}
                    aria-hidden={i !== active}
                    draggable={false}
                  >
                    <img src={p.image_url} alt={p.name} draggable={false} />
                  </Link>
                ))}

                <button className="spot__nav spot__nav--prev" onClick={() => go(active - 1)} aria-label="Previous product">
                  <ArrowLeft size={18} />
                </button>
                <button className="spot__nav spot__nav--next" onClick={() => go(active + 1)} aria-label="Next product">
                  <ArrowRight size={18} />
                </button>
              </>
            )}
          </div>

          {current && !loading && (
            <div className="spot__card">
              <div className="spot__bars" role="tablist" aria-label="Spotlight products">
                {slides.map((p, i) => (
                  <button
                    key={p.id}
                    role="tab"
                    aria-selected={i === active}
                    aria-label={`${i + 1} of ${n}: ${displayName(p.name)}`}
                    className={`spot__bar ${i < active ? "spot__bar--done" : ""} ${i === active ? "spot__bar--on" : ""}`}
                    onClick={() => go(i)}
                  >
                    <i
                      key={i === active ? `on-${cycle}` : "off"}
                      style={{ animationDuration: `${SLIDE_MS}ms` }}
                      onAnimationEnd={() => {
                        if (!reduced && i === active) go(active + 1);
                      }}
                    />
                  </button>
                ))}
              </div>
              <div className="spot__card-body" key={`c-${current.id}`}>
              <div className="spot__card-top">
                <span className="spot__count">
                  {String(active + 1).padStart(2, "0")} <em>/ {String(n).padStart(2, "0")}</em>
                </span>
                <span className="spot__cat">{current.category}</span>
                <WishlistButton product={current} />
              </div>
              <Link to={`/products/${current.id}`} className="spot__name">
                {displayName(current.name)}
              </Link>
              <div className="spot__meta">
                <b>{formatPrice(current.price)}</b>
                <span className="spot__swatches">
                  {current.colors.slice(0, 4).map((c) => (
                    <span key={c} className="swatch-dot" style={{ background: swatch(c) }} title={titleCase(c)} />
                  ))}
                </span>
                <span className={`spot__stock ${current.total_stock <= 30 ? "spot__stock--low" : ""}`}>
                  {current.total_stock <= 30 ? `Only ${current.total_stock} left` : `In stock · ${current.sizes_available} sizes`}
                </span>
              </div>
              <Link to={`/products/${current.id}`} className="btn btn--primary spot__shop">
                Shop now <ArrowRight size={16} />
              </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="hero__scroll">
        <span />
      </div>
    </section>
  );
}

function Ambient({ kind, reduced }: { kind: Campaign["ambient"]; reduced: boolean }) {
  const pieces = useMemo(() => {
    const count = kind === "snow" ? 36 : 12;
    return Array.from({ length: count }, (_, i) => ({
      x: (i * 97.3) % 100,
      delay: -((i * 3.7) % 18),
      dur: 14 + ((i * 5.3) % 12),
      scale: 0.6 + ((i * 0.37) % 0.8),
      hue: i % 4,
    }));
  }, [kind]);

  if (!kind || reduced) return null;
  return (
    <div className={`ambient ambient--${kind}`} aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className={`ambient__p ambient__p--${p.hue}`}
          style={{
            left: `${p.x}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            ["--s" as string]: p.scale,
          }}
        >
          {kind === "leaves" && (
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path
                d="M12 2.5 13.6 6l3.4-1-1 3.6 3.5 1.2-2.9 2.3 1.6 3.3-3.6-.4-.6 3.6L12 16.2 10 18.6l-.6-3.6-3.6.4 1.6-3.3-2.9-2.3 3.5-1.2-1-3.6 3.4 1Z"
                fill="currentColor"
              />
              <path d="M12 16v6" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          )}
        </span>
      ))}
    </div>
  );
}
