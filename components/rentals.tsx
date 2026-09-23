"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  MessageCircle,
  Package,
  Send,
  ShieldCheck,
} from "lucide-react";
import type { FullBooking } from "@/lib/services";
import { useApp } from "./context";
import { Badge, dateLabel, Empty, Stat } from "./ui";
import { label, money, transitions } from "@/lib/domain";
import { RentalProgress } from "./RentalProgress";

export const actionMap: Record<
  string,
  { action: string; text: string; role: string }[]
> = {
  AWAITING_APPROVAL: [
    { action: "approve", text: "Approve request", role: "owner" },
    { action: "reject", text: "Decline request", role: "owner" },
  ],
  PAYMENT_PENDING: [
    { action: "pay", text: "Complete simulated payment", role: "renter" },
  ],
  PAYMENT_FAILED: [{ action: "pay", text: "Retry payment", role: "renter" }],
  CONFIRMED: [
    { action: "prepare", text: "Prepare & document condition", role: "owner" },
  ],
  PREPARING: [
    { action: "ship", text: "Dispatch / ready for pickup", role: "owner" },
  ],
  SHIPPED: [{ action: "deliver", text: "Confirm receipt", role: "renter" }],
  READY_FOR_PICKUP: [
    { action: "deliver", text: "Confirm collection", role: "renter" },
  ],
  DELIVERED: [
    { action: "start", text: "Start rental", role: "renter" },
    { action: "issue", text: "Report a problem", role: "renter" },
    { action: "return", text: "Request early return", role: "renter" },
  ],
  RENTAL_ACTIVE: [{ action: "return", text: "Request return", role: "renter" }],
  ISSUE_REPORTED: [
    { action: "return", text: "Return problem item", role: "renter" },
  ],
  RETURN_REQUESTED: [
    { action: "returnShip", text: "Send return", role: "renter" },
  ],
  RETURN_IN_TRANSIT: [
    { action: "receive", text: "Confirm item returned", role: "owner" },
  ],
  RETURNED: [{ action: "inspect", text: "Begin inspection", role: "owner" }],
  INSPECTION: [
    { action: "pass", text: "Pass inspection & complete", role: "owner" },
    { action: "damage", text: "Report damage", role: "owner" },
  ],
  DAMAGE_REPORTED: [
    { action: "dispute", text: "Dispute the claim", role: "renter" },
  ],
  RESOLVED: [
    { action: "complete", text: "Complete rental & pay owner", role: "owner" },
  ],
};
export function Timeline({ id }: { id: string }) {
  const { state } = useApp();
  const booking = state.bookings.find((b) => b.id === id);
  const events = state.events
    .filter(
      (e) =>
        e.entityId === id ||
        (booking &&
          [booking.itemId, booking.renterId].includes(e.entityId) &&
          new Date(e.createdAt) >= new Date(booking.createdAt)),
    )
    .slice()
    .reverse();
  return (
    <div className="timeline">
      {events.map((e, i) => (
        <div className="timeline-event" key={e.id}>
          <span
            className={`timeline-dot ${i === events.length - 1 ? "current" : ""}`}
          >
            <Check size={10} />
          </span>
          <div>
            <strong>{label(e.type)}</strong>
            <small>
              {new Date(e.simulatedAt).toLocaleString("en-GB", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "UTC",
              })}{" "}
              · {state.users.find((u) => u.id === e.actor)?.name || e.actor}
            </small>
            {e.oldState && (
              <span className="event-state">
                {label(e.oldState)} → {label(e.newState)}
              </span>
            )}
            <details>
              <summary>Event details</summary>
              <pre>
                {JSON.stringify(
                  {
                    id: e.id,
                    entityType: e.entityType,
                    entityId: e.entityId,
                    recordedAt: e.createdAt,
                    metadata: JSON.parse(e.metadata),
                  },
                  null,
                  2,
                )}
              </pre>
            </details>
          </div>
        </div>
      ))}
    </div>
  );
}
export function BookingActions({
  booking: b,
  simulator = false,
}: {
  booking: FullBooking;
  simulator?: boolean;
}) {
  const { actor, mutate, busy } = useApp();
  const [notes, setNotes] = useState(""),
    [photos, setPhotos] = useState(""),
    [amount, setAmount] = useState(
      String((b.claim?.amount ?? Math.round(b.depositAmount * 0.2)) / 100),
    ),
    [decision, setDecision] = useState("RENTER_RESPONSIBLE"),
    [cancelBy, setCancelBy] = useState("RENTER");
  const allowed = (role: string) =>
    actor.role === "ADMIN" ||
    (role === "owner"
      ? actor.id === b.item.ownerId
      : role === "renter"
        ? actor.id === b.renterId
        : false);
  const actions = (actionMap[b.status] || []).filter((a) => allowed(a.role));
  const act = (action: string) =>
    mutate({
      kind: "booking",
      id: b.id,
      action,
      data: {
        notes: notes || undefined,
        photos: photos ? JSON.stringify([photos]) : undefined,
        amount: Math.round(Number(amount) * 100),
        decision,
        cancelBy,
      },
    });
  return (
    <div className="workflow-actions">
      {[
        "PREPARING",
        "INSPECTION",
        "DAMAGE_REPORTED",
        "DISPUTE",
        "DELIVERED",
        "CONFIRMED",
      ].includes(b.status) && (
        <>
          <label>
            Condition notes / evidence
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add useful details for the next person…"
              rows={2}
            />
          </label>
          {["CONFIRMED", "INSPECTION"].includes(b.status) && (
            <label>
              Condition photo
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    const fd = new FormData();
                    fd.append("file", f);
                    const r = await fetch("/api/upload", {
                      method: "POST",
                      body: fd,
                    });
                    const d = await r.json();
                    if (r.ok) setPhotos(d.url);
                    else setNotes(d.error);
                  }
                }}
              />
              {photos && <small>Evidence photo attached</small>}
            </label>
          )}
        </>
      )}
      {["INSPECTION", "DAMAGE_REPORTED", "DISPUTE"].includes(b.status) && (
        <label>
          Claim / deduction (€)
          <input
            type="number"
            min="0"
            max={(b.claim?.amount ?? b.depositAmount) / 100}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
      )}
      {["DAMAGE_REPORTED", "DISPUTE"].includes(b.status) &&
        actor.role === "ADMIN" && (
          <>
            <label>
              Admin decision
              <select
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
              >
                {[
                  "NO_DAMAGE",
                  "RENTER_RESPONSIBLE",
                  "OWNER_RESPONSIBLE",
                  "SHARED_RESPONSIBILITY",
                ].map((d) => (
                  <option key={d} value={d}>
                    {label(d)}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="button"
              disabled={busy}
              onClick={() => act("resolve")}
            >
              Resolve claim & settle deposit <ShieldCheck size={16} />
            </button>
          </>
        )}
      <div className="action-buttons">
        {actions.map((a) => (
          <button
            key={a.action}
            disabled={busy}
            className={
              ["damage", "reject", "issue"].includes(a.action)
                ? "outline-btn"
                : "button"
            }
            onClick={() => act(a.action)}
          >
            {a.text}
            <ArrowRight size={15} />
          </button>
        ))}
      </div>
      {!actions.length &&
        ![
          "COMPLETED",
          "CANCELLED",
          "REJECTED",
          "DISPUTE",
          "DAMAGE_REPORTED",
        ].includes(b.status) && (
          <p className="muted">
            Next action: {actionMap[b.status]?.[0]?.text}. Switch to the{" "}
            {actionMap[b.status]?.[0]?.role} account to continue.
          </p>
        )}
      {transitions[b.status]?.includes("CANCELLED") &&
        (actor.role === "ADMIN" ||
          [b.renterId, b.item.ownerId].includes(actor.id)) && (
          <div className="cancel-controls">
            {simulator && (
              <select
                aria-label="Cancellation initiated by"
                value={cancelBy}
                onChange={(e) => setCancelBy(e.target.value)}
              >
                {["RENTER", "OWNER", "PLATFORM"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            )}
            <button
              className="text-link muted"
              disabled={busy}
              onClick={() => act("cancel")}
            >
              Cancel booking
            </button>
          </div>
        )}
    </div>
  );
}
export function BookingFinancials({ booking: b }: { booking: FullBooking }) {
  return (
    <div className="price-breakdown">
      <div>
        <span>Rental · {b.days} days</span>
        <strong>{money(b.rental)}</strong>
      </div>
      <div>
        <span>Service fee</span>
        <span>{money(b.serviceFee)}</span>
      </div>
      <div>
        <span>Delivery</span>
        <span>{money(b.deliveryFee)}</span>
      </div>
      <div>
        <span>Simulated protection</span>
        <span>{money(b.insuranceFee)}</span>
      </div>
      <div>
        <span>Deposit</span>
        <span>{money(b.depositAmount)}</span>
      </div>
      {b.lateFee > 0 && (
        <div>
          <span>Late fee</span>
          <span>{money(b.lateFee)}</span>
        </div>
      )}
      <div className="price-total">
        <strong>
          {b.status === "COMPLETED"
            ? "Final total"
            : "Total + accrued late fees"}
        </strong>
        <strong>
          {money(b.total + (b.status === "COMPLETED" ? 0 : b.lateFee))}
        </strong>
      </div>
      <div>
        <span>Payment refunded</span>
        <span>{money(b.payment?.refunded || 0)}</span>
      </div>
      <div>
        <span>Deposit released</span>
        <span>{money(b.deposit?.released || 0)}</span>
      </div>
      <div>
        <span>Deposit deducted</span>
        <span>{money(b.deposit?.captured || 0)}</span>
      </div>
      <div>
        <span>Owner payout</span>
        <strong>
          {b.payout ? money(b.payout.amount) : "After completion"}
        </strong>
      </div>
    </div>
  );
}
export function Conversation({ booking: b }: { booking: FullBooking }) {
  const { state, actor, mutate, busy } = useApp(),
    [text, setText] = useState("");
  return (
    <div className="conversation">
      <h3>
        <MessageCircle size={18} /> A conversation about your rental
      </h3>
      <div className="message-list">
        {b.messages.length ? (
          b.messages.map((m) => (
            <div
              className={`message ${m.senderId === actor.id ? "mine" : ""}`}
              key={m.id}
            >
              <strong>
                {state.users.find((u) => u.id === m.senderId)?.name}
                <small>
                  {new Date(m.createdAt).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </small>
              </strong>
              <p>{m.text}</p>
            </div>
          ))
        ) : (
          <p className="muted">
            Ask about fit, delivery, or caring for this piece.
          </p>
        )}
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await mutate({ kind: "message", id: b.id, data: { text } });
          if (r) setText("");
        }}
      >
        <input
          aria-label="Message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a message…"
          required
          maxLength={2000}
        />
        <button
          className="button"
          disabled={busy || !text.trim()}
          aria-label="Send message"
        >
          <Send size={17} />
        </button>
      </form>
    </div>
  );
}
function ReviewForm({ booking: b }: { booking: FullBooking }) {
  const { actor, mutate, busy } = useApp(),
    [rating, setRating] = useState(5),
    [comment, setComment] = useState("");
  if (
    b.reviews.some((r) => r.authorId === actor.id) ||
    ![b.renterId, b.item.ownerId].includes(actor.id)
  )
    return null;
  return (
    <form
      className="panel"
      onSubmit={async (e) => {
        e.preventDefault();
        await mutate({ kind: "review", id: b.id, data: { rating, comment } });
      }}
    >
      <h3>How was your rental?</h3>
      <label>
        Rating
        <select
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
        >
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} stars
            </option>
          ))}
        </select>
      </label>
      <label>
        Your review
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          minLength={3}
          required
        />
      </label>
      <button className="button" disabled={busy}>
        Publish review
      </button>
    </form>
  );
}
export function BookingDetail({ id }: { id: string }) {
  const { state, actor } = useApp();
  const b = state.bookings.find((b) => b.id === id);
  if (!b) return <Empty title="Booking not found." />;
  if (
    actor.role !== "ADMIN" &&
    ![b.renterId, b.item.ownerId].includes(actor.id)
  )
    return (
      <div className="page">
        <Empty
          title="Switch to a booking participant"
          body="Use Sara, the owner of this piece, or Admin to view this rental."
        />
      </div>
    );
  return (
    <div className="page">
      <Link className="back-link" href="/dashboard/rentals">
        <ArrowLeft size={15} /> My rentals
      </Link>
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR PIECE. YOUR MOMENT.</div>
          <h1>Your rental journey.</h1>
          <p>
            {dateLabel(b.startDate)} – {dateLabel(b.endDate)} · {b.days} days
          </p>
        </div>
        <Badge status={b.status} />
      </div>
      {b.overdue && (
        <div className="notice warning">
          <Clock3 size={18} /> This return is overdue. Current late fee:{" "}
          {money(b.lateFee)}.
        </div>
      )}
      <RentalProgress booking={b} />
      <div className="rental-layout">
        <div>
          <div className="rental-hero">
            <img src={JSON.parse(b.item.images)[0]} alt={b.item.title} />
            <div>
              <span className="eyebrow">{b.item.brand}</span>
              <h2>{b.item.title}</h2>
              <p>
                Renter: {b.renter.name}
                <br />
                Owner: {b.item.owner.name}
              </p>
              <span className="muted small">
                Booking {b.id.slice(-8).toUpperCase()}
              </span>
            </div>
          </div>
          <div className="panel">
            <h3>Up next</h3>
            <BookingActions booking={b} />
          </div>
          <div className="state-grid compact">
            <Stat
              label="Payment"
              value={<Badge status={b.payment?.status || "PENDING"} />}
            />
            <Stat
              label="Deposit"
              value={<Badge status={b.deposit?.status || "PENDING"} />}
            />
            <Stat
              label="Delivery"
              value={<Badge status={b.delivery?.status || "NOT_STARTED"} />}
            />
          </div>
          {b.delivery && (
            <div className="panel">
              <h3>
                <Package size={18} /> Delivery tracking
              </h3>
              <p>
                {label(b.delivery.method)} · {b.delivery.tracking}
              </p>
              {b.delivery.events.map((e) => (
                <div className="tracking-event" key={e.id}>
                  {label(e.status)} <small>{dateLabel(e.simulatedAt)}</small>
                </div>
              ))}
            </div>
          )}
          {b.reports.length > 0 && (
            <div className="panel">
              <h3>Condition comparison</h3>
              <div className="report-grid">
                {b.reports.map((r) => (
                  <div key={r.id}>
                    <span className="eyebrow">{r.phase}</span>
                    <h4>{r.condition}</h4>
                    <p>{r.notes}</p>
                    {JSON.parse(r.photos).map((src: string, n: number) => (
                      <img
                        key={n}
                        src={src}
                        alt={`${r.phase} condition evidence`}
                      />
                    ))}
                    <small>
                      {dateLabel(r.simulatedAt)} ·{" "}
                      {state.users.find((u) => u.id === r.createdBy)?.name}
                    </small>
                  </div>
                ))}
              </div>
            </div>
          )}
          {b.claim && (
            <div className="notice warning">
              <div>
                <h3>Damage claim · {money(b.claim.amount)}</h3>
                <p>{b.claim.description}</p>
                <Badge status={b.claim.status} />
                {b.claim.decision && (
                  <p>
                    {label(b.claim.decision)} · Deduction{" "}
                    {money(b.claim.deduction)}
                  </p>
                )}
              </div>
            </div>
          )}
          <Conversation booking={b} />
          {b.status === "COMPLETED" && <ReviewForm booking={b} />}
        </div>
        <aside>
          <div className="panel">
            <h3>Your rental, at a glance</h3>
            <BookingFinancials booking={b} />
          </div>
          <div className="panel">
            <h3>Every step, in one place</h3>
            <Timeline id={id} />
          </div>
        </aside>
      </div>
    </div>
  );
}
export function BookingList({ all = false }: { all?: boolean }) {
  const { state, actor } = useApp();
  const bookings = state.bookings.filter(
    (b) => all || b.renterId === actor.id || b.item.ownerId === actor.id,
  );
  return bookings.length ? (
    <div className="booking-list">
      {bookings.map((b) => (
        <Link key={b.id} href={`/bookings/${b.id}`} className="booking-row">
          <img src={JSON.parse(b.item.images)[0]} alt="" />
          <div>
            <strong>{b.item.title}</strong>
            <small>
              {dateLabel(b.startDate)} – {dateLabel(b.endDate)}
              {b.scenarioId && " · Simulator"}
            </small>
            <small>
              {b.renter.name} → {b.item.owner.name}
            </small>
          </div>
          <div>
            <Badge status={b.status} />
            {b.overdue && <span className="overdue">Return overdue</span>}
          </div>
          <strong>{money(b.total)}</strong>
          <ArrowRight size={18} />
        </Link>
      ))}
    </div>
  ) : (
    <Empty
      title="Your next chapter starts here."
      body="Browse the wardrobe and reserve your first piece."
    />
  );
}
export function Rentals() {
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR SHARED WARDROBE</div>
          <h1>My rentals.</h1>
          <p>
            Upcoming moments, current favorites, and pieces you’ve returned.
          </p>
        </div>
        <Link className="button" href="/explore">
          Find your next piece <ArrowRight size={16} />
        </Link>
      </div>
      <BookingList />
    </div>
  );
}
export function Messages() {
  const { state, actor } = useApp();
  const bookings = state.bookings.filter(
    (b) =>
      actor.role === "ADMIN" ||
      b.renterId === actor.id ||
      b.item.ownerId === actor.id,
  );
  const [selected, setSelected] = useState("");
  const b = bookings.find((b) => b.id === selected) || bookings[0];
  return (
    <div className="page">
      <div className="page-intro">
        <h1>Your conversations.</h1>
        <p>A little connection makes a better rental.</p>
      </div>
      <div className="message-layout">
        <div className="message-sidebar">
          {bookings.map((x) => (
            <button
              className={x.id === b?.id ? "selected" : ""}
              onClick={() => setSelected(x.id)}
              key={x.id}
            >
              <strong>{x.item.title}</strong>
              <small>
                {x.renter.name} & {x.item.owner.name}
              </small>
            </button>
          ))}
        </div>
        {b ? (
          <Conversation booking={b} />
        ) : (
          <Empty title="No conversations yet." />
        )}
      </div>
    </div>
  );
}
export function Notifications() {
  const { state, actor, mutate, busy } = useApp();
  const notifications = state.notifications.filter(
    (n) => n.userId === actor.id,
  );
  return (
    <div className="page narrow">
      <div className="page-heading">
        <div>
          <div className="eyebrow">KEEPING YOU IN THE LOOP</div>
          <h1>Your updates.</h1>
        </div>
        <button
          className="outline-btn"
          disabled={busy}
          onClick={() => mutate({ kind: "read" })}
        >
          Mark all as read
        </button>
      </div>
      {notifications.length ? (
        notifications.map((n) => (
          <Link
            className={`notification ${n.read ? "read" : ""}`}
            key={n.id}
            href={n.bookingId ? `/bookings/${n.bookingId}` : "/dashboard"}
          >
            <span className="notification-dot" />
            <div>
              <strong>{n.text}</strong>
              <small>
                {new Date(n.simulatedAt).toLocaleString("en-GB", {
                  timeZone: "UTC",
                })}
              </small>
            </div>
            <ArrowRight size={16} />
          </Link>
        ))
      ) : (
        <Empty title="You’re all caught up." />
      )}
    </div>
  );
}
