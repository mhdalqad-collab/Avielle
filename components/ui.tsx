import Link from "next/link";
import { ArrowUpRight, Check, ShieldCheck, Star } from "lucide-react";
import type { CatalogItem } from "@/lib/snapshot";
import { label, money } from "@/lib/domain";
export function Badge({ status }: { status: string }) {
  return (
    <span
      className={`badge ${["LUXURY", "VERIFIED", "COMPLETED", "RELEASED", "CAPTURED", "ACTIVE"].includes(status) ? "good" : ["DISPUTE", "DAMAGE_REPORTED", "PAYMENT_FAILED", "REJECTED", "SUSPENDED"].includes(status) ? "warn" : ""}`}
    >
      {status === "LUXURY" && <ShieldCheck size={12} />} {label(status)}
    </span>
  );
}
export function ItemCard({ item }: { item: CatalogItem }) {
  return (
    <Link className="item-card" href={`/items/${item.id}`}>
      <div className="item-photo">
        <img src={JSON.parse(item.images)[0]} alt={item.title} loading="lazy" />
        {item.tier === "LUXURY" && (
          <span className="photo-label">
            <ShieldCheck size={12} /> THE LUXURY EDIT
          </span>
        )}
        <span className="item-arrow">
          <ArrowUpRight size={19} />
        </span>
      </div>
      <div className="item-meta">
        <span>{item.brand}</span>
        <span>
          <Star size={12} fill="currentColor" /> {item.owner.rating.toFixed(1)}
        </span>
      </div>
      <h3>{item.title}</h3>
      <div className="item-bottom">
        <span>
          <strong>{money(item.rentalPricePerDay)}</strong> / day
        </span>
        <span>
          {item.size} · {item.location}
        </span>
      </div>
    </Link>
  );
}
export function SectionTitle({
  eyebrow,
  title,
  href,
  link = "Explore the collection",
}: {
  eyebrow?: string;
  title: string;
  href?: string;
  link?: string;
}) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
      </div>
      {href && (
        <Link className="text-link" href={href}>
          {link} <ArrowUpRight size={17} />
        </Link>
      )}
    </div>
  );
}
export function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {body && <p>{body}</p>}
    </div>
  );
}
export function CheckLine({
  ok,
  children,
}: {
  ok: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`check-line ${ok ? "" : "unchecked"}`}>
      <span>{ok ? <Check size={13} /> : "–"}</span>
      {children}
    </div>
  );
}
export function Stat({
  label: caption,
  value,
  detail,
}: {
  label: string;
  value: React.ReactNode;
  detail?: string;
}) {
  return (
    <div className="stat">
      <span>{caption}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}
export const dateLabel = (s: string) =>
  new Date(s).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
