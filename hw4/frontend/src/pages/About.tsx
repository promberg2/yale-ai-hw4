import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchProducts, type ProductSummary } from "../api";
import { ArrowRight, PinIcon } from "../components/Icons";
import { useReveal } from "../lib/useReveal";

const TIMELINE = [
  {
    year: "1975",
    title: "A store across from campus",
    text: "Barry Cobden opens a Yale University memorabilia store on Broadway, directly across from campus — the start of Campus Customs.",
  },
  {
    year: "40+ yrs",
    title: "The Official Y Sweater",
    text: "We develop the original replica Y sweater — 100% cotton with a sewn-on felt Y. Over forty years later it remains a staple.",
  },
  {
    year: "1990s",
    title: "Printing in-house",
    text: "Under the direction of Joel Cobden, the family expands into screen printing, bringing design and production under our own roof.",
  },
  {
    year: "2005–07",
    title: "Everyone under one roof",
    text: "After a two-year renovation, the former York Square Cinema next door becomes a modern print shop and a bright, spacious retail store.",
  },
  {
    year: "Today",
    title: "The next generation",
    text: "Brothers Joel and Jeremy Cobden run the family business, with more than 65 people through the year and stores in New Haven, Branford, and Celebration, Florida.",
  },
];

const VALUES = [
  {
    n: "01",
    title: "Tradition",
    text: "Think tradition, experience our experience. We have stood on the same corner of Broadway for five decades, outfitting generations of Yale families.",
  },
  {
    n: "02",
    title: "Exceptional service",
    text: "Our father's standard of customer service is still our top priority. We simply hate the thought of anyone not being happy with the end result.",
  },
  {
    n: "03",
    title: "Made next door",
    text: "Screen printing, embroidery, and digital printing happen in our own production facility beside the original store — for quick turnarounds and real quality control.",
  },
  {
    n: "04",
    title: "Family, first",
    text: "We're a family business that has grown to include many families. Building long-term relationships with our customers is what we love most.",
  },
];

export default function About() {
  const [gallery, setGallery] = useState<ProductSummary[]>([]);

  useEffect(() => {
    fetchProducts({ q: "college", limit: 6 }).then(setGallery).catch(() => undefined);
  }, []);

  useReveal([gallery]);

  return (
    <div className="about">
      <section className="about__hero">
        <div className="hero__grain" />
        <div className="container about__hero-inner">
          <span className="eyebrow eyebrow--light">About Us · Est. 1975</span>
          <h1 className="about__title">
            Fifty years on Broadway.
            <br />
            <em>One Yale family.</em>
          </h1>
          <p className="about__lede">
            Campus Customs is New Haven's oldest official Yale merchandise retailer — a family business that began with a
            single store across from campus and still opens its doors, seven days a week, in the very same spot.
          </p>
        </div>
      </section>

      <section className="section container about__intro">
        <div className="about__quote reveal">
          <span className="about__mark">“</span>
          <blockquote>
            Campus Customs started in 1975 when our father opened a Yale University memorabilia store directly across from
            the campus. Although he is retired now, we continue to run the company, keeping his exceptional customer service
            and ethical business practices as our top priorities.
          </blockquote>
          <cite>— Joel &amp; Jeremy Cobden, owners</cite>
        </div>
        <div className="about__story reveal">
          <h2 className="display">Yale Bulldog Blue is our home for Yale pride online.</h2>
          <p>
            Everything we sell is officially licensed — shirts, hoodies, crewnecks, quarter-zips, and gifts for students,
            alumni, families, and fans. From residential-college crests to graduate-school classics and varsity sports, we
            carry the gear that tells your Yale story.
          </p>
          <p>
            And because our design, screen printing, and embroidery studio sits right next door to the original store, the
            pieces you wear are made with New Haven care — by people who have been part of this campus community for
            decades.
          </p>
          <Link to="/products" className="btn btn--primary">
            Explore the collection <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      <section className="section section--tint">
        <div className="container">
          <div className="section__head reveal">
            <div>
              <span className="eyebrow">Our story</span>
              <h2 className="display">From one storefront to a New Haven institution.</h2>
            </div>
          </div>
          <ol className="timeline">
            {TIMELINE.map((t, i) => (
              <li key={t.year} className="timeline__item reveal" style={{ transitionDelay: `${i * 80}ms` }}>
                <span className="timeline__year">{t.year}</span>
                <div className="timeline__dot" />
                <div className="timeline__body">
                  <h3>{t.title}</h3>
                  <p>{t.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section container">
        <div className="section__head reveal">
          <div>
            <span className="eyebrow">What we stand for</span>
            <h2 className="display">We pretty much do it all — and we're happy to do it.</h2>
          </div>
        </div>
        <div className="values">
          {VALUES.map((v, i) => (
            <div key={v.n} className="value reveal" style={{ transitionDelay: `${i * 80}ms` }}>
              <span className="value__n">{v.n}</span>
              <h3>{v.title}</h3>
              <p>{v.text}</p>
            </div>
          ))}
        </div>
      </section>

      {gallery.length > 0 && (
        <section className="about__gallery reveal">
          <div className="about__gallery-track">
            {[...gallery, ...gallery].map((p, i) => (
              <Link key={`${p.id}-${i}`} to={`/products/${p.id}`} className="about__gallery-item">
                <img src={p.image_url} alt={p.name} loading="lazy" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="section container">
        <div className="services reveal">
          <div>
            <span className="eyebrow">Beyond the store</span>
            <h2 className="display">Custom apparel for your team, club, or reunion.</h2>
            <p className="section__sub">
              Campus Customs also offers screen printing, embroidery, digital printing, graphic design, and complete event
              merchandise — for organizations, businesses, and family reunions, from New Haven to clients across the country.
            </p>
          </div>
          <ul className="services__list">
            {["Screen printing", "Embroidery", "Digital printing", "Graphic design", "Web stores & fulfillment", "Event merchandise"].map((s) => (
              <li key={s}>
                <span />
                {s}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="visit">
        <div className="container visit__inner reveal">
          <div className="visit__copy">
            <span className="eyebrow eyebrow--light">Come visit us!</span>
            <h2 className="display display--light">
              Same corner.
              <br />
              <em>Since 1975.</em>
            </h2>
            <p>57 Broadway, New Haven, CT 06511 — open seven days a week. We'd love to help you find your size in person.</p>
            <div className="visit__actions">
              <a
                className="btn btn--light"
                href="https://maps.google.com/?q=57+Broadway,+New+Haven,+CT+06511"
                target="_blank"
                rel="noreferrer"
              >
                <PinIcon size={18} /> Get directions
              </a>
              <a className="btn btn--ghost-light" href="mailto:orderdept@campuscustoms.com">
                Email our team
              </a>
            </div>
          </div>
          <div className="about__locations">
            {[
              ["New Haven", "57 Broadway, New Haven, CT 06511", "Flagship · Since 1975"],
              ["Branford", "184 Maple Street, Branford, CT 06405", "Campus Customs Branford"],
              ["Florida", "715 Bloom Street, Suite 140, Celebration, FL 34747", "Campus Customs Florida"],
            ].map(([city, addr, note]) => (
              <div key={city} className="location">
                <span>{note}</span>
                <h3>{city}</h3>
                <p>{addr}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
