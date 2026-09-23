"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  MapPin,
  ShieldCheck,
  Star,
  Truck,
} from "lucide-react";
import { useApp } from "./context";
import { Badge, CheckLine, dateLabel, Empty } from "./ui";
import {
  day,
  isoDay,
  label,
  money,
  PricingService,
  terminal,
} from "@/lib/domain";

export function ItemDetail({
  id,
  checkout = false,
}: {
  id: string;
  checkout?: boolean;
}) {
  const { state, actor, mutate, busy } = useApp(),
    router = useRouter(),
    item = state.items.find((i) => i.id === id);
  const today = isoDay(state.clock.now),
    [start, setStart] = useState(today),
    [end, setEnd] = useState(
      isoDay(new Date(Date.parse(today) + 2 * day).toISOString()),
    ),
    [method, setMethod] = useState(
      item?.deliveryOptions.split(",")[0] || "OWNER_SHIPPING",
    ),
    [insurance, setInsurance] = useState(item?.insuranceRequired || false),
    [imageIndex, setImageIndex] = useState(0);
  if (!item) return <Empty title="This piece could not be found." />;
  const images: string[] = JSON.parse(item.images),
    reserved = state.bookings.filter(
      (b) => b.itemId === id && !terminal.includes(b.status),
    ),
    conflict = reserved.some((b) => b.startDate <= end && b.endDate >= start);
  let quote: ReturnType<typeof PricingService.quote> | undefined,
    error = "";
  try {
    quote = PricingService.quote(
      item.rentalPricePerDay,
      item.securityDeposit,
      start,
      end,
      method,
      insurance,
    );
  } catch (e) {
    error = (e as Error).message;
  }
  const blocked =
    conflict ||
    start < today ||
    start < item.availableFrom ||
    end > item.availableTo ||
    ["MAINTENANCE", "SUSPENDED", "PENDING_APPROVAL"].includes(item.status);
  const reviews = state.bookings
    .filter((b) => b.itemId === id)
    .flatMap((b) => b.reviews.filter((r) => r.authorId === b.renterId));
  const book = async () => {
    const result = (await mutate({
      kind: "book",
      data: { itemId: id, startDate: start, endDate: end, method, insurance },
    })) as { id: string } | null;
    if (result) router.push(`/bookings/${result.id}`);
  };
  return (
    <div className="page">
      <Link className="back-link" href="/explore">
        <ArrowLeft size={15} /> Back to the wardrobe
      </Link>
      <div className="item-layout">
        <div>
          <div className="detail-image">
            <img src={images[imageIndex]} alt={item.title} />
            <Badge status={item.tier} />
          </div>
          {images.length > 1 && (
            <div className="thumbnails">
              {images.map((im, i) => (
                <button
                  key={i}
                  aria-label={`View photo ${i + 1}`}
                  onClick={() => setImageIndex(i)}
                >
                  <img src={im} alt="" />
                </button>
              ))}
            </div>
          )}
          <div className="detail-description">
            <div className="eyebrow">THE DETAILS</div>
            <h2>A little more about this piece.</h2>
            <p>{item.description}</p>
            <div className="spec-grid">
              {[
                ["Condition", item.condition],
                ["Size", item.size],
                ["Color", item.color],
                ["Category", item.category],
                ["Fit", item.gender],
                ["Retail value", money(item.replacementValue)],
              ].map(([a, b]) => (
                <div key={a}>
                  <span>{a}</span>
                  <strong>{b}</strong>
                </div>
              ))}
            </div>
            {item.tier === "LUXURY" && (
              <div className="luxury-details">
                <h3>
                  <ShieldCheck size={18} /> A considered luxury rental
                </h3>
                <p>
                  {item.designer} · {item.collection} · {item.year}
                </p>
                <p>
                  Serial: {item.serialNumber} ·{" "}
                  {item.certificate || "Authentication pending"}
                </p>
                <p>{item.proofOfPurchase}</p>
                <p>
                  Before and after condition reports are recorded for every
                  rental. Deposit held through inspection.
                </p>
              </div>
            )}
            <h3>Availability</h3>
            <p>
              {dateLabel(item.availableFrom)} – {dateLabel(item.availableTo)}
            </p>
            <div className="calendar-grid">
              {Array.from({ length: 28 }, (_, n) => {
                const d = isoDay(
                    new Date(Date.parse(today) + n * day).toISOString(),
                  ),
                  taken = reserved.some(
                    (b) => b.startDate <= d && b.endDate >= d,
                  );
                return (
                  <button
                    title={taken ? "Reserved" : d}
                    disabled={taken}
                    className={d >= start && d <= end ? "selected" : ""}
                    key={d}
                    onClick={() => {
                      setStart(d);
                      setEnd(
                        isoDay(new Date(Date.parse(d) + 2 * day).toISOString()),
                      );
                    }}
                  >
                    <small>
                      {new Date(d).toLocaleDateString("en", {
                        weekday: "short",
                        timeZone: "UTC",
                      })}
                    </small>
                    {new Date(d).getUTCDate()}
                  </button>
                );
              })}
            </div>
            <small className="muted">
              Select a start day for a three-day rental, or enter your own
              dates. Crossed-out dates are reserved.
            </small>
            <h3>Cancellation & care</h3>
            <p>
              Full rental refund at least 48 hours before the start. Later
              renter cancellations receive 50%; owner and platform cancellations
              receive a full refund. Deposits are released in full on
              cancellation. Return by 23:59 UTC on the last day; daily late fees
              begin after a six-hour grace period.
            </p>
            <h3>From the shared wardrobe</h3>
            {reviews.length ? (
              reviews.map((r) => (
                <div className="review" key={r.id}>
                  <strong>{"★".repeat(r.rating)}</strong>
                  <p>{r.comment}</p>
                </div>
              ))
            ) : (
              <p>No reviews for this piece yet. Be part of its next chapter.</p>
            )}
          </div>
        </div>
        <div className="item-info">
          <div className="eyebrow">{item.brand}</div>
          <h1>{item.title}</h1>
          <div className="item-rating">
            <Star size={15} fill="currentColor" />{" "}
            {item.owner.rating.toFixed(1)} owner rating <span>·</span>{" "}
            <MapPin size={15} />
            {item.location}
          </div>
          <div className="owner-mini">
            <span className="avatar">{item.owner.name[0]}</span>
            <div>
              <strong>From {item.owner.name.split(" ")[0]}’s wardrobe</strong>
              <small>
                {item.owner.role === "INFLUENCER"
                  ? "Verified influencer"
                  : "Independent owner"}
              </small>
            </div>
            {item.owner.verified && <ShieldCheck size={22} />}
          </div>
          <div className="booking-card">
            <div className="price-heading">
              <strong>
                {money(item.rentalPricePerDay)}
                <small> / day</small>
              </strong>
              <Badge status={item.tier} />
            </div>
            <p className="muted">
              {checkout
                ? "Review your dates and reserve this piece."
                : "Choose your dates. Make it your moment."}
            </p>
            <div className="form-row">
              <label>
                From
                <input
                  type="date"
                  value={start}
                  min={today > item.availableFrom ? today : item.availableFrom}
                  max={item.availableTo}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label>
                Until
                <input
                  type="date"
                  value={end}
                  min={start}
                  max={item.availableTo}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
            </div>
            <label>
              How would you like to receive it?
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                {item.deliveryOptions.split(",").map((m) => (
                  <option key={m} value={m}>
                    {label(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={insurance}
                onChange={(e) => setInsurance(e.target.checked)}
              />
              Simulated protection{" "}
              {item.insuranceRequired ? "(required)" : "(optional)"} · 5%
            </label>
            {quote && (
              <div className="price-breakdown">
                <div>
                  <span>
                    {money(item.rentalPricePerDay)} × {quote.days} days
                  </span>
                  <span>{money(quote.rental)}</span>
                </div>
                <div>
                  <span>Service fee · 10%</span>
                  <span>{money(quote.serviceFee)}</span>
                </div>
                <div>
                  <span>Delivery</span>
                  <span>{money(quote.deliveryFee)}</span>
                </div>
                {insurance && (
                  <div>
                    <span>Simulated protection</span>
                    <span>{money(quote.insuranceFee)}</span>
                  </div>
                )}
                <div>
                  <span>Refundable security deposit</span>
                  <span>{money(quote.depositAmount)}</span>
                </div>
                <div className="price-total">
                  <strong>Total at confirmation</strong>
                  <strong>{money(quote.total)}</strong>
                </div>
              </div>
            )}
            {item.tier === "LUXURY" && (
              <div className="eligibility">
                <CheckLine ok={actor.identityVerified}>
                  Identity verified{" "}
                  {!actor.identityVerified && (
                    <button
                      className="text-link"
                      disabled={busy}
                      onClick={() => mutate({ kind: "verify" })}
                    >
                      Verify now
                    </button>
                  )}
                </CheckLine>
                <CheckLine ok={item.authenticationStatus === "VERIFIED"}>
                  Item authenticity verified
                </CheckLine>
                <CheckLine ok={item.owner.verified}>Owner verified</CheckLine>
                <CheckLine ok={actor.rating >= item.minimumRenterRating}>
                  Minimum renter rating: {item.minimumRenterRating}
                </CheckLine>
                <CheckLine ok={actor.active}>Account active</CheckLine>
              </div>
            )}
            {error && <p className="inline-error">{error}</p>}
            {blocked && (
              <p className="inline-error">
                {conflict
                  ? "These dates are reserved. Choose another period."
                  : "This piece is not available for these dates."}
              </p>
            )}
            <button
              className="button full"
              disabled={busy || !!error || blocked || actor.id === item.ownerId}
              onClick={book}
            >
              {item.approvalRequired
                ? "Request this piece"
                : "Reserve this piece"}{" "}
              <ArrowRight size={17} />
            </button>
            <small className="center muted">
              {item.approvalRequired
                ? "Owner approval comes before simulated payment."
                : "Simulated payment is completed on the next screen."}
            </small>
            <div className="secure-note">
              <ShieldCheck size={16} /> Secure deposit · No real payment
            </div>
          </div>
          <div className="delivery-note">
            <Truck size={20} />
            <div>
              <strong>Ready for your next occasion</strong>
              <p>Professionally cared for. Thoughtfully packaged.</p>
            </div>
          </div>
          <p className="small muted">
            Demo photos are illustrative and may differ from listing
            descriptions. No real authentication or insurance is provided.
          </p>
        </div>
      </div>
    </div>
  );
}
