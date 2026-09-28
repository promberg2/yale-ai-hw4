import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { displayName, fetchCategories, fetchProducts, formatPrice, type CategoryCount, type ProductSummary } from "../api";
import Countdown from "../components/Countdown";
import { ArrowRight, PinIcon, ReturnIcon, ShieldIcon, TruckIcon } from "../components/Icons";
import ProductCard, { ProductCardSkeleton } from "../components/ProductCard";
import SeasonHero from "../components/SeasonHero";
import { bandFor, campaignFor, loadWeather, nextGame, typicalWeather, WEATHER_EDITS, type Weather } from "../lib/season";
import { useReveal } from "../lib/useReveal";

const NEW_IDS = [
  "hype-and-vice-yale-university-premium-crewneck",
  "hype-and-vice-yale-university-offside-crewneck",
  "brooks-brothers-bomber-jacket-yale",
  "brooks-brothers-double-knit-full-zip-hoodie-yale",
];
const CLASSIC_IDS = [
  "champion-reverse-weave-crewneck",
  "basic-hoodie-big-yale",
  "poly-twill-crewneck-arched-yale",
  "t-felt-y-heavyweight",
  "super-heavyweight-crewneck-arched-yale-crest",
  "district-vit-crewneck-vintage-bulldog",
  "big-yale-tri-blend-t-shirt",
  "boola-boola-t-shirt",
];
const TAILGATE_IDS = ["ua-gameday-double-knit-hood", "yale-bowl-t-shirt", "football-left-chest-t-shirt"];

const COLLEGES = [
  "Benjamin Franklin", "Berkeley", "Branford", "Davenport", "Grace Hopper", "Jonathan Edwards",
  "Morse", "Pierson", "Saybrook", "Timothy Dwight", "Trumbull",
];
const SCHOOLS = [
  ["Architecture", "architecture"], ["Art", "school of art"], ["Divinity", "divinity"], ["Engineering", "engineering"],
  ["Law", "law"], ["Management", "management"], ["Medicine", "medicine"], ["Music", "music"],
  ["Nursing", "nursing"], ["Public Health", "public health"], ["Environment", "forest"],
] as const;
const FAMILY = ["Mom", "Dad", "Grandma", "Grandpa", "Aunt", "Uncle", "Brother", "Cousin"];

export default function Home() {
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [params] = useSearchParams();
  const now = useMemo(() => new Date(), []);
  const campaign = useMemo(() => campaignFor(now, params.get("season")), [now, params]);
  const game = useMemo(() => nextGame(now), [now]);
  const daysToGame = Math.ceil((game.getTime() - now.getTime()) / 86_400_000);
  const [weather, setWeather] = useState<Weather | null>(null);

  useEffect(() => {
    let alive = true;
    loadWeather(now).then((w) => alive && setWeather(w));
    return () => {
      alive = false;
    };
  }, [now]);

  useEffect(() => {
    Promise.all([fetchProducts(), fetchCategories()])
      .then(([p, c]) => {
        setProducts(p);
        setCategories(c);
      })
      .finally(() => setLoading(false));
  }, []);

  useReveal([loading, weather]);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const pick = (ids: string[]) => ids.map((id) => byId.get(id)).filter((p): p is ProductSummary => Boolean(p));

  const tailgate = pick(TAILGATE_IDS);
  const forecast = weather ?? typicalWeather(now);
  const edit = WEATHER_EDITS[bandFor(forecast.tempF)];
  const gameDay = game.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="home">
      {/* ------------------------------------------------ Hero */}
      <SeasonHero
        campaign={campaign}
        slides={pick(campaign.spotlight)}
        loading={loading}
        weather={weather}
        daysToGame={daysToGame}
      />

      {/* ------------------------------------------------ Marquee */}
      <div className="marquee" aria-hidden="true">
        <div className="marquee__track">
          {Array.from({ length: 2 }).map((_, k) => (
            <div key={k} className="marquee__group">
              {["Boola Boola", "Hoodies", "Crewnecks", "Quarter-Zips", "Residential Colleges", "Game Day", "Alumni", "Family Weekend", "The Game"].map((w) => (
                <span key={w}>
                  {w} <i>✦</i>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------ Dress for today's weather */}
      <section className="section container forecast">
        <div className="forecast__card reveal">
          <span className="eyebrow">{forecast.live ? "Right now in New Haven" : "This time of year in New Haven"}</span>
          <div className="forecast__temp">
            {forecast.tempF}
            <sup>°F</sup>
          </div>
          <div className="forecast__cond">
            {forecast.live ? forecast.condition : "Typical daytime high"} · <b>{edit.label}</b>
          </div>
          <p>{edit.tip}</p>
          <Link to={edit.shop.to} className="btn btn--light">
            {edit.shop.label} <ArrowRight size={16} />
          </Link>
        </div>
        <div className="forecast__picks">
          <div className="forecast__head reveal">
            <h2 className="display">Dressed for {forecast.tempF}° today.</h2>
            <p className="section__sub">
              {forecast.live ? "Updated with the live forecast" : "Picked for the season"} — the four pieces we would reach for
              walking out the door on Broadway this morning.
            </p>
          </div>
          <div className="grid grid--4 forecast__grid">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
              : pick(edit.ids).map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ Categories */}
      <section className="section container">
        <div className="section__head reveal">
          <div>
            <span className="eyebrow">Shop by category</span>
            <h2 className="display">Everything Yale, head to toe.</h2>
          </div>
          <Link to="/products" className="text-link">
            View all products <ArrowRight size={16} />
          </Link>
        </div>
        <div className="cat-grid">
          {(loading ? Array.from({ length: 6 }) : categories).map((c, i) =>
            c ? (
              <Link
                key={(c as CategoryCount).name}
                to={`/products?category=${encodeURIComponent((c as CategoryCount).name)}`}
                className={`cat-tile reveal ${i === 0 ? "cat-tile--lg" : ""}`}
                style={{ transitionDelay: `${i * 70}ms` }}
              >
                <div className="cat-tile__img">
                  <img src={(c as CategoryCount).image_url} alt="" loading="lazy" />
                </div>
                <div className="cat-tile__label">
                  <h3>{(c as CategoryCount).name}</h3>
                  <span>
                    {(c as CategoryCount).count} styles <ArrowRight size={15} />
                  </span>
                </div>
              </Link>
            ) : (
              <div key={i} className={`cat-tile shimmer ${i === 0 ? "cat-tile--lg" : ""}`} />
            ),
          )}
        </div>
      </section>

      {/* ------------------------------------------------ New from Hype & Vice */}
      <section className="section section--tint">
        <div className="container">
          <div className="section__head reveal">
            <div>
              <span className="eyebrow">Just landed</span>
              <h2 className="display">New from Hype &amp; Vice</h2>
              <p className="section__sub">
                Fresh Yale collaborations and premium labels — Hype &amp; Vice, Brooks Brothers, and more — arriving on our
                shelves this season.
              </p>
            </div>
            <Link to="/products?sort=price_desc" className="text-link">
              Shop premium <ArrowRight size={16} />
            </Link>
          </div>
          <div className="grid grid--4">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
              : pick(NEW_IDS).map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ Back in Bulldog Blue */}
      <section className="section container">
        <div className="section__head reveal">
          <div>
            <span className="eyebrow">The classics</span>
            <h2 className="display">
              Back in Bulldog Blue <span className="heart">💙</span>
            </h2>
            <p className="section__sub">
              The pieces New Haven reaches for year after year — the Big Yale hoodie, arched-letter crewnecks, and heritage
              tees that belong in every Yale wardrobe.
            </p>
          </div>
        </div>
        <div className="rail">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} />)
            : pick(CLASSIC_IDS).map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
        </div>
      </section>

      {/* ------------------------------------------------ Tailgate Season */}
      <section className="tailgate">
        <div className="container tailgate__inner">
          <div className="tailgate__copy reveal">
            <span className="eyebrow eyebrow--light">Yale vs. Harvard · {gameDay}</span>
            <h2 className="display display--light">
              Game day starts
              <br />
              <em>on Broadway.</em>
            </h2>
            <Countdown to={game} label={`Countdown to The Game on ${gameDay}`} />
            <p>
              From the Yale Bowl to The Game, suit up in Bulldog Blue. Rivalry-ready hoods, left-chest football classics, and
              cozy layers for those crisp November Saturdays.
            </p>
            <Link to="/products?q=football" className="btn btn--light btn--lg">
              Shop game day <ArrowRight size={18} />
            </Link>
          </div>
          <div className="tailgate__stack reveal">
            {tailgate.map((p, i) => (
              <Link key={p.id} to={`/products/${p.id}`} className={`tailgate__card tailgate__card--${i}`}>
                <img src={p.image_url} alt={p.name} loading="lazy" />
                <div>
                  <span>{displayName(p.name)}</span>
                  <b>{formatPrice(p.price)}</b>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ Colleges & Schools */}
      <section className="section container">
        <div className="colleges reveal">
          <div className="colleges__intro">
            <span className="eyebrow">Wear your crest</span>
            <h2 className="display">Your college. Your school. Your colors.</h2>
            <p className="section__sub">
              Every residential college and graduate school has its own story — and its own gear. Find the crest that's
              yours.
            </p>
          </div>
          <div className="colleges__lists">
            <div>
              <h4>Residential Colleges</h4>
              <div className="chip-cloud">
                {COLLEGES.map((c) => (
                  <Link key={c} to={`/products?q=${encodeURIComponent(c.toLowerCase())}`} className="chip">
                    {c}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <h4>Graduate &amp; Professional Schools</h4>
              <div className="chip-cloud">
                {SCHOOLS.map(([label, q]) => (
                  <Link key={label} to={`/products?q=${encodeURIComponent(q)}`} className="chip">
                    {label}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <h4>For the whole family</h4>
              <div className="chip-cloud">
                {FAMILY.map((f) => (
                  <Link key={f} to={`/products?q=${encodeURIComponent(`yale ${f.toLowerCase()}`)}`} className="chip chip--soft">
                    Yale {f}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ Service promises */}
      <section className="promises container reveal">
        <div className="promise">
          <ShieldIcon size={26} />
          <div>
            <h4>Officially licensed</h4>
            <p>Authentic Yale merchandise from New Haven's original Yale retailer.</p>
          </div>
        </div>
        <div className="promise">
          <TruckIcon size={26} />
          <div>
            <h4>Printed next door</h4>
            <p>Most orders are processed in 8–10 business days from our own studio.</p>
          </div>
        </div>
        <div className="promise">
          <ReturnIcon size={26} />
          <div>
            <h4>Easy returns</h4>
            <p>Not quite right? We accept returns and exchanges on standard items.</p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ Visit */}
      <section className="visit">
        <div className="container visit__inner reveal">
          <div className="visit__copy">
            <span className="eyebrow eyebrow--light">Come visit us!</span>
            <h2 className="display display--light">
              57 Broadway,
              <br />
              <em>New Haven.</em>
            </h2>
            <p>
              Directly across from campus, in the same spot where it all began in 1975. Stop by to try on your size, find a
              gift, or just say hello — we're open seven days a week.
            </p>
            <div className="visit__actions">
              <a
                className="btn btn--light"
                href="https://maps.google.com/?q=57+Broadway,+New+Haven,+CT+06511"
                target="_blank"
                rel="noreferrer"
              >
                <PinIcon size={18} /> Get directions
              </a>
              <Link to="/about" className="btn btn--ghost-light">
                Meet the family
              </Link>
            </div>
          </div>
          <div className="visit__card">
            <div className="visit__map">
              <div className="visit__pin">
                <PinIcon size={22} />
              </div>
              <span className="visit__street visit__street--a">Broadway</span>
              <span className="visit__street visit__street--b">York St</span>
              <span className="visit__street visit__street--c">Elm St</span>
            </div>
            <dl>
              <div>
                <dt>Address</dt>
                <dd>57 Broadway, New Haven, CT 06511</dd>
              </div>
              <div>
                <dt>Hours</dt>
                <dd>Open 7 days a week</dd>
              </div>
              <div>
                <dt>Order help</dt>
                <dd>orderdept@campuscustoms.com</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </div>
  );
}
