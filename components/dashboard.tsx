"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  LayoutDashboard,
  MessageCircle,
  Plus,
  Shirt,
  ShoppingBag,
  Upload,
} from "lucide-react";
import { useApp } from "./context";
import { Badge, Empty, Stat } from "./ui";
import { BookingList } from "./rentals";
import { isoDay, money, terminal } from "@/lib/domain";
export function Dashboard({ path }: { path: string }) {
  const { state, actor, mutate, busy } = useApp();
  const items = state.items.filter(
    (i) => i.ownerId === actor.id && !i.id.startsWith("sim-"),
  );
  const bookings = state.bookings.filter(
    (b) => b.item.ownerId === actor.id || b.renterId === actor.id,
  );
  return (
    <div className="dashboard-layout">
      <aside className="side-nav">
        <span className="eyebrow">YOUR SPACE</span>
        {[
          [LayoutDashboard, "Overview", "/dashboard"],
          [Shirt, "My listings", "/dashboard/items"],
          [ShoppingBag, "My rentals", "/dashboard/rentals"],
          [MessageCircle, "Messages", "/dashboard/messages"],
          [Bell, "Notifications", "/dashboard/notifications"],
        ].map(([Icon, title, url]) => {
          const I = Icon as typeof Shirt;
          return (
            <Link
              key={String(url)}
              className={path === url ? "active" : ""}
              href={String(url)}
            >
              <I size={18} />
              {String(title)}
            </Link>
          );
        })}
        <Link href="/admin">
          Marketplace admin <ArrowUpRight size={15} />
        </Link>
      </aside>
      <div className="dashboard-main">
        <div className="page-heading">
          <div>
            <div className="eyebrow">A WARDROBE WITH POSSIBILITIES</div>
            <h1>
              {path === "/dashboard/items"
                ? "Your pieces."
                : `Hello, ${actor.name.split(" ")[0]}.`}
            </h1>
            <p>
              {path === "/dashboard/items"
                ? "Give great pieces their next chapter."
                : "Here’s what’s happening in your shared wardrobe."}
            </p>
          </div>
          <Link className="button" href="/dashboard/new">
            <Plus size={17} /> List a piece
          </Link>
        </div>
        <div className="stats-grid">
          <Stat
            label="Active rentals"
            value={bookings.filter((b) => !terminal.includes(b.status)).length}
          />
          <Stat label="Your listings" value={items.length} />
          <Stat
            label="Owner payouts"
            value={money(
              bookings
                .filter((b) => b.item.ownerId === actor.id)
                .reduce((n, b) => n + (b.payout?.amount || 0), 0),
            )}
          />
          <Stat label="Your rating" value={`${actor.rating.toFixed(1)} / 5`} />
        </div>
        {path === "/dashboard/items" ? (
          items.length ? (
            <div className="listing-list">
              {items.map((i) => (
                <div className="listing-row" key={i.id}>
                  <img src={JSON.parse(i.images)[0]} alt="" />
                  <div>
                    <Link href={`/items/${i.id}`}>
                      <strong>{i.title}</strong>
                    </Link>
                    <small>
                      {i.brand} · {money(i.rentalPricePerDay)} / day
                    </small>
                  </div>
                  <Badge status={i.status} />
                  {i.status === "PENDING_APPROVAL" ? (
                    <span className="small muted">
                      Awaiting authentication & approval
                    </span>
                  ) : (
                    <button
                      className="outline-btn"
                      disabled={busy}
                      onClick={() =>
                        mutate({
                          kind: "item",
                          id: i.id,
                          data: {
                            status:
                              i.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED",
                          },
                        })
                      }
                    >
                      {i.status === "SUSPENDED" ? "Activate" : "Pause listing"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title="Your wardrobe has room for a first listing."
              body="Switch to an owner account, then add a piece."
            />
          )
        ) : (
          <>
            <div className="section-title">
              <h2>Your rental activity</h2>
              <Link className="text-link" href="/dashboard/messages">
                Your messages <ArrowRight size={16} />
              </Link>
            </div>
            <BookingList />
          </>
        )}
      </div>
    </div>
  );
}
export function ListingForm() {
  const { actor, mutate, busy, state } = useApp(),
    router = useRouter();
  const [tier, setTier] = useState("NORMAL"),
    [images, setImages] = useState<string[]>([]),
    [uploadError, setUploadError] = useState(""),
    [uploading, setUploading] = useState(false);
  if (!["OWNER", "INFLUENCER", "ADMIN"].includes(actor.role))
    return (
      <div className="page narrow">
        <div className="page-intro">
          <h1>Open up your wardrobe.</h1>
          <p>
            Switch to Daniel or a luxury owner in the demo account menu to list
            a piece.
          </p>
        </div>
      </div>
    );
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      str = (name: string) => String(f.get(name) || ""),
      num = (name: string) => Math.round(Number(f.get(name)) * 100);
    const result = (await mutate({
      kind: "listing",
      data: {
        title: str("title"),
        description: str("description"),
        brand: str("brand"),
        category: str("category"),
        tier,
        size: str("size"),
        gender: str("gender"),
        color: str("color"),
        condition: str("condition"),
        rentalPricePerDay: num("daily"),
        securityDeposit: num("deposit"),
        replacementValue: num("value"),
        location: str("location"),
        availableFrom: str("from"),
        availableTo: str("to"),
        deliveryOptions: f.getAll("delivery").join(","),
        approvalRequired: f.has("approval") || tier === "LUXURY",
        images: JSON.stringify(images),
        designer: str("designer"),
        collection: str("collection"),
        year: Number(f.get("year") || 2026),
        serialNumber: str("serial"),
        proofOfPurchase: "Simulated purchase record",
        certificate: "",
        insuranceRequired: f.has("insurance"),
        minimumRenterRating: Number(f.get("rating") || 0),
        identityVerificationRequired: tier === "LUXURY",
      },
    })) as { id: string } | null;
    if (result) router.push("/dashboard/items");
  };
  const input = (
    name: string,
    title: string,
    type = "text",
    value?: string,
  ) => (
    <label>
      {title}
      <input
        name={name}
        type={type}
        required
        defaultValue={value}
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? "0.01" : undefined}
      />
    </label>
  );
  return (
    <div className="page narrow">
      <div className="page-intro">
        <div className="eyebrow">SHARE SOMETHING SPECIAL</div>
        <h1>A new chapter for your piece.</h1>
        <p>Good fashion deserves to be worn. Let’s get it ready.</p>
      </div>
      <form onSubmit={submit} className="listing-form">
        <section className="panel">
          <h2>
            <span>01</span> Tell its story
          </h2>
          {input("title", "Listing title")}
          {input("brand", "Brand")}
          <label>
            Description
            <textarea
              name="description"
              required
              minLength={10}
              rows={4}
              placeholder="The fit, the feeling, the occasions it’s perfect for…"
            />
          </label>
          <div className="form-row">
            <label>
              Category
              <select name="category">
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
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            {input("size", "Size")}
          </div>
          <div className="form-row">
            {input("color", "Color")}
            <label>
              Fit
              <select name="gender">
                <option>Unisex</option>
                <option>Women</option>
                <option>Men</option>
              </select>
            </label>
            <label>
              Condition
              <select name="condition">
                <option>Excellent</option>
                <option>Very good</option>
                <option>Good</option>
                <option>New with tags</option>
              </select>
            </label>
          </div>
        </section>
        <section className="panel">
          <h2>
            <span>02</span> Show its best side
          </h2>
          <div className="upload-area">
            <Upload size={28} />
            <strong>Add up to 8 photos</strong>
            <span>JPEG, PNG, or WebP · up to 5 MB each</span>
            <input
              aria-label="Upload item photos"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={async (e) => {
                setUploadError("");
                setUploading(true);
                const result = [...images];
                try {
                  for (const file of Array.from(e.target.files || []).slice(
                    0,
                    8 - images.length,
                  )) {
                    const fd = new FormData();
                    fd.append("file", file);
                    const r = await fetch("/api/upload", {
                      method: "POST",
                      body: fd,
                    });
                    const d = await r.json();
                    if (!r.ok) throw new Error(d.error);
                    result.push(d.url);
                  }
                  setImages(result);
                } catch (err) {
                  setUploadError((err as Error).message);
                } finally {
                  setUploading(false);
                }
              }}
            />
          </div>
          {uploadError && <p className="inline-error">{uploadError}</p>}
          <div className="thumbnails">
            {images.map((im, n) => (
              <div key={im}>
                <img src={im} alt={`Listing photo ${n + 1}`} />
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setImages(images.filter((x) => x !== im))}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2>
            <span>03</span> Make it rentable
          </h2>
          <label>
            Collection
            <select value={tier} onChange={(e) => setTier(e.target.value)}>
              <option value="NORMAL">Everyday / Normal</option>
              <option value="LUXURY">Luxury</option>
            </select>
          </label>
          <div className="form-row">
            {input("daily", "Daily rental (€)", "number")}
            {input("deposit", "Security deposit (€)", "number")}
            {input("value", "Replacement value (€)", "number")}
          </div>
          {input("location", "Location", "text", "Berlin")}
          <div className="form-row">
            {input("from", "Available from", "date", isoDay(state.clock.now))}
            {input("to", "Available until", "date", "2027-12-31")}
          </div>
          <label>Delivery options</label>
          {["OWNER_SHIPPING", "PLATFORM_COURIER", "LOCAL_PICKUP"].map((m) => (
            <label className="checkbox" key={m}>
              <input name="delivery" type="checkbox" value={m} defaultChecked />
              {m.toLowerCase().replaceAll("_", " ")}
            </label>
          ))}
          <label className="checkbox">
            <input
              type="checkbox"
              name="approval"
              defaultChecked={tier === "LUXURY"}
            />
            Require approval for each request
          </label>
        </section>
        {tier === "LUXURY" && (
          <section className="panel">
            <h2>
              <span>04</span> A little extra assurance
            </h2>
            <p>
              Luxury pieces go to Admin for authentication and approval. All
              documentation is simulated.
            </p>
            {input("designer", "Designer")}
            {input("collection", "Collection")}
            <div className="form-row">
              {input("year", "Year", "number", "2026")}
              {input("serial", "Demo serial number")}
            </div>
            <label>
              Minimum renter rating
              <input
                name="rating"
                type="number"
                min="0"
                max="5"
                step="0.1"
                defaultValue="4"
              />
            </label>
            <label className="checkbox">
              <input name="insurance" type="checkbox" defaultChecked />
              Require simulated insurance
            </label>
          </section>
        )}
        <button
          className="button full"
          disabled={busy || uploading || images.length === 0}
        >
          {tier === "LUXURY"
            ? "Submit for authentication"
            : "Publish your piece"}{" "}
          <ArrowRight size={18} />
        </button>
        {images.length === 0 && (
          <p className="muted center">
            Add at least one photo before publishing.
          </p>
        )}
      </form>
    </div>
  );
}
