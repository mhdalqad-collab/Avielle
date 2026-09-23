"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Truck,
} from "lucide-react";
import { useApp } from "./context";
import { ItemCard, SectionTitle, Empty } from "./ui";
import { terminal } from "@/lib/domain";
export function Home() {
  const { state } = useApp();
  const items = state.items.filter(
    (i) =>
      !i.id.startsWith("sim-") &&
      !["PENDING_APPROVAL", "SUSPENDED", "MAINTENANCE"].includes(i.status),
  );
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span /> GREAT STYLE. NEW POSSIBILITIES.
          </div>
          <h1>
            A wardrobe
            <br />
            without <em>limits.</em>
          </h1>
          <p>
            For the big moments. And the just-because ones.
            <br />
            Rent pieces you love, for as long as you need.
          </p>
          <div className="hero-buttons">
            <Link className="button" href="/explore">
              Find your next look <ArrowUpRight size={18} />
            </Link>
            <Link className="text-link" href="/luxury">
              Explore luxury <ArrowRight size={16} />
            </Link>
          </div>
          <div className="hero-proof">
            <div className="avatar-stack">
              <span>S</span>
              <span>L</span>
              <span>M</span>
            </div>
            <div>
              <span className="proof-stars">★★★★★</span>
              <small>A new way to fall in love with fashion</small>
            </div>
          </div>
        </div>
        <div className="hero-image">
          <img
            src="/images/hero.jpg"
            alt="Fashion editorial: sculptural white tailoring with black accessories"
          />
          <div className="hero-tag">
            <span>THE ART OF DRESSING DIFFERENTLY</span>
            <strong>Yours for the moment.</strong>
            <Link
              href="/explore?category=Suits"
              aria-label="Explore tailored pieces"
            >
              <ArrowUpRight size={25} />
            </Link>
          </div>
          <span className="image-credit">THE SHARED WARDROBE — VOL. 01</span>
        </div>
      </section>
      <div className="trust-strip">
        <span>
          <ShieldCheck /> Considered pieces. Verified owners.
        </span>
        <span>
          <Truck /> Delivered to your door
        </span>
        <span>
          <Sparkles /> Wear. Return. Repeat.
        </span>
      </div>
      <section className="section">
        <SectionTitle
          eyebrow="GOOD STYLE, WITHOUT THE COMMITMENT"
          title="Your next great outfit starts here."
          href="/explore"
          link="View all pieces"
        />
        <form className="search-bar" action="/explore">
          <Search />
          <input
            name="q"
            aria-label="Search pieces, designers, or occasions"
            placeholder="A wedding guest dress, the perfect suit, a little luxury…"
          />
          <button className="button" type="submit">
            Explore the wardrobe <ArrowRight size={16} />
          </button>
        </form>
        <div className="category-row">
          {[
            "Suits",
            "Dresses",
            "Bags",
            "Jackets",
            "Shoes",
            "Accessories",
            "Coats",
            "Evening Wear",
          ].map((c) => (
            <Link href={`/explore?category=${encodeURIComponent(c)}`} key={c}>
              {c} <ArrowUpRight size={14} />
            </Link>
          ))}
        </div>
      </section>
      <section className="section collection-section">
        <SectionTitle
          eyebrow="EXTRAORDINARY PIECES. JUST FOR YOU."
          title="The luxury edit"
          href="/luxury"
        />
        <div className="product-grid">
          {items
            .filter((i) => i.tier === "LUXURY")
            .slice(0, 4)
            .map((i) => (
              <ItemCard key={i.id} item={i} />
            ))}
        </div>
      </section>
      <section className="section">
        <SectionTitle
          eyebrow="EVERYDAY, ELEVATED"
          title="New plans. New possibilities."
          href="/everyday"
        />
        <div className="product-grid">
          {[items[1], items[3], items[4], items[0]].filter(Boolean).map((i) => (
            <ItemCard key={i.id} item={i} />
          ))}
        </div>
      </section>
      <section className="closet-banner">
        <div className="closet-images">
          <img
            src="/images/dress.jpg"
            alt="Floral dress from a curated closet"
          />
          <img src="/images/suit.jpg" alt="Tailoring from a curated closet" />
        </div>
        <div>
          <div className="eyebrow">GOOD TASTE IS BETTER SHARED</div>
          <h2>
            Step inside
            <br />
            their wardrobes.
          </h2>
          <p>
            The pieces you saved. The style you love.
            <br />
            Explore closets curated by your favorite creators.
          </p>
          <Link className="button light" href="/influencers">
            Meet the tastemakers <ArrowUpRight size={17} />
          </Link>
        </div>
      </section>
      <section className="section">
        <SectionTitle
          eyebrow="ON EVERYONE’S WISHLIST"
          title="Worth making plans for"
          href="/explore?sort=popular"
        />
        <div className="product-grid">
          {items
            .filter((i) =>
              ["item-6", "item-8", "item-27", "item-31"].includes(i.id),
            )
            .map((i) => (
              <ItemCard key={i.id} item={i} />
            ))}
        </div>
      </section>
      <section className="section how-it-works">
        <div>
          <div className="eyebrow">A LIGHTER WAY TO DRESS</div>
          <h2>
            More wearing.
            <br />
            Less owning.
          </h2>
        </div>
        {[
          [
            "01",
            "Find your piece",
            "Discover everyday favorites and extraordinary designer pieces.",
          ],
          [
            "02",
            "Make it yours",
            "Choose your dates. We’ll take care of the rental details.",
          ],
          [
            "03",
            "Enjoy. Return. Repeat.",
            "Make your memories, then send it on to its next chapter.",
          ],
        ].map(([n, t, d]) => (
          <div key={n}>
            <span className="step-number">{n}</span>
            <h3>{t}</h3>
            <p>{d}</p>
          </div>
        ))}
      </section>
    </>
  );
}
export function Explore({ tier }: { tier: string }) {
  const { state } = useApp();
  const params =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
  const [query, setQuery] = useState(params.get("q") || ""),
    [category, setCategory] = useState(params.get("category") || ""),
    [selectedTier, setTier] = useState(tier),
    [brand, setBrand] = useState(""),
    [size, setSize] = useState(""),
    [location, setLocation] = useState(""),
    [method, setMethod] = useState(""),
    [ownerType, setOwnerType] = useState(""),
    [rating, setRating] = useState(""),
    [maxPrice, setMaxPrice] = useState(""),
    [minPrice, setMinPrice] = useState(""),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [available, setAvailable] = useState(true),
    [sort, setSort] = useState(params.get("sort") || "recommended"),
    [filters, setFilters] = useState(false);
  const catalog = state.items.filter((i) => !i.id.startsWith("sim-"));
  const filtered = catalog.filter(
    (i) =>
      !["DRAFT", "PENDING_APPROVAL", "SUSPENDED"].includes(i.status) &&
      (!query ||
        `${i.title} ${i.brand} ${i.category}`
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (!selectedTier || i.tier === selectedTier) &&
      (!category || i.category === category) &&
      (!brand || i.brand === brand) &&
      (!size || i.size === size) &&
      (!location || i.location === location) &&
      (!method || i.deliveryOptions.includes(method)) &&
      (!ownerType || i.owner.role === ownerType) &&
      (!rating || i.owner.rating >= Number(rating)) &&
      (!maxPrice || i.rentalPricePerDay <= Number(maxPrice) * 100) &&
      (!minPrice || i.rentalPricePerDay >= Number(minPrice) * 100) &&
      (!available || i.status !== "MAINTENANCE") &&
      (!start || i.availableFrom <= start) &&
      (!end || i.availableTo >= end) &&
      (!(start && end) ||
        !state.bookings.some(
          (b) =>
            b.itemId === i.id &&
            !terminal.includes(b.status) &&
            b.startDate <= end &&
            b.endDate >= start,
        )),
  );
  filtered.sort((a, b) =>
    sort === "low"
      ? a.rentalPricePerDay - b.rentalPricePerDay
      : sort === "high"
        ? b.rentalPricePerDay - a.rentalPricePerDay
        : sort === "rating"
          ? b.owner.rating - a.owner.rating
          : sort === "newest"
            ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            : sort === "popular"
              ? state.bookings.filter((x) => x.itemId === b.id).length -
                state.bookings.filter((x) => x.itemId === a.id).length
              : 0,
  );
  const select = (
    caption: string,
    value: string,
    set: (s: string) => void,
    values: string[],
  ) => (
    <label>
      {caption}
      <select value={value} onChange={(e) => set(e.target.value)}>
        <option value="">All {caption.toLowerCase()}</option>
        {values.map((v) => (
          <option key={v} value={v}>
            {v.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="page">
      <div className={`page-intro ${tier === "LUXURY" ? "luxury-intro" : ""}`}>
        <div className="eyebrow">
          {tier === "LUXURY"
            ? "AUTHENTICATED. CONSIDERED. EXCEPTIONAL."
            : "THE SHARED WARDROBE"}
        </div>
        <h1>
          {tier === "LUXURY"
            ? "The luxury edit."
            : tier === "NORMAL"
              ? "Everyday, elevated."
              : "Find your next favorite."}
        </h1>
        <p>
          {tier === "LUXURY"
            ? "Extraordinary pieces from verified closets. Yours for the moments that matter."
            : "A whole world of style. A little less ownership."}
        </p>
      </div>
      <div className="discovery-tools">
        <div className="search-input">
          <Search size={20} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pieces, brands, occasions…"
            aria-label="Search inventory"
          />
        </div>
        <button className="outline-btn" onClick={() => setFilters(!filters)}>
          <SlidersHorizontal size={17} /> Filters
        </button>
        <select
          aria-label="Sort items"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="recommended">Recommended</option>
          <option value="low">Price: low to high</option>
          <option value="high">Price: high to low</option>
          <option value="popular">Most popular</option>
          <option value="newest">Newest</option>
          <option value="rating">Highest rated</option>
        </select>
      </div>
      <div className="filter-chips">
        {[
          "",
          "Suits",
          "Dresses",
          "Bags",
          "Jackets",
          "Shoes",
          "Accessories",
          "Coats",
          "Evening Wear",
        ].map((c) => (
          <button
            key={c}
            className={category === c ? "selected" : ""}
            onClick={() => setCategory(c)}
          >
            {c || "All pieces"}
          </button>
        ))}
      </div>
      {filters && (
        <div className="filter-panel">
          {select("Tier", selectedTier, setTier, ["NORMAL", "LUXURY"])}
          {select("Brand", brand, setBrand, [
            ...new Set(catalog.map((i) => i.brand)),
          ])}
          {select("Size", size, setSize, [
            ...new Set(catalog.map((i) => i.size)),
          ])}
          {select("Location", location, setLocation, ["Berlin", "Hamburg"])}
          {select("Delivery", method, setMethod, [
            "OWNER_SHIPPING",
            "PLATFORM_COURIER",
            "LOCAL_PICKUP",
          ])}
          {select("Owner type", ownerType, setOwnerType, [
            "OWNER",
            "INFLUENCER",
          ])}
          {select("Rating", rating, setRating, ["4", "4.5", "4.8", "4.9"])}
          <label>
            Min. price / day (€)
            <input
              type="number"
              min="0"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
            />
          </label>
          <label>
            Max. price / day (€)
            <input
              type="number"
              min="0"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </label>
          <label>
            Rental start
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            Rental end
            <input
              type="date"
              min={start}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={available}
              onChange={(e) => setAvailable(e.target.checked)}
            />
            Available inventory only
          </label>
          <button
            className="text-link"
            onClick={() => {
              setTier(tier);
              setBrand("");
              setSize("");
              setLocation("");
              setMethod("");
              setOwnerType("");
              setRating("");
              setMaxPrice("");
              setMinPrice("");
              setStart("");
              setEnd("");
              setQuery("");
              setCategory("");
            }}
          >
            Clear filters
          </button>
        </div>
      )}
      <div className="results-line">
        <span>{filtered.length} pieces to make your own</span>
        <span>
          <ShieldCheck size={14} /> Every rental, thoughtfully protected
        </span>
      </div>
      {start && end && end < start ? (
        <Empty title="Choose an end date after the start date." />
      ) : filtered.length ? (
        <div className="product-grid">
          {filtered.map((i) => (
            <ItemCard key={i.id} item={i} />
          ))}
        </div>
      ) : (
        <Empty
          title="No pieces match just yet."
          body="Try a different category, date, or price range."
        />
      )}
    </div>
  );
}
export function Influencers() {
  const { state } = useApp();
  const [selected, setSelected] = useState("");
  const people = state.users.filter((u) => u.role === "INFLUENCER");
  return (
    <div className="page">
      <div className="page-intro">
        <div className="eyebrow">A PERSONAL INVITATION</div>
        <h1>Closets worth opening.</h1>
        <p>Discover the pieces behind the people who inspire your style.</p>
      </div>
      <div className="influencer-grid">
        {people.map((p, i) => (
          <button
            key={p.id}
            className={`influencer-card ${selected === p.id ? "selected" : ""}`}
            onClick={() => setSelected(selected === p.id ? "" : p.id)}
          >
            <img
              src={
                ["/images/hero.jpg", "/images/dress.jpg", "/images/suit.jpg"][i]
              }
              alt={`${p.name}'s curated style`}
            />
            <div>
              <span>
                {p.username} · {(p.followers / 1000).toFixed(0)}k followers
              </span>
              <h2>
                {p.name} <ShieldCheck size={22} />
              </h2>
              <p>{p.bio}</p>
              <strong>
                Open the closet <ArrowUpRight size={17} />
              </strong>
            </div>
          </button>
        ))}
      </div>
      <SectionTitle
        title={
          selected
            ? `${people.find((p) => p.id === selected)?.name.split(" ")[0]}’s closet`
            : "From their wardrobe to yours"
        }
      />
      <div className="product-grid">
        {state.items
          .filter(
            (i) =>
              !i.id.startsWith("sim-") &&
              i.status === "ACTIVE" &&
              i.owner.role === "INFLUENCER" &&
              (!selected || i.ownerId === selected),
          )
          .map((i) => (
            <ItemCard key={i.id} item={i} />
          ))}
      </div>
    </div>
  );
}
