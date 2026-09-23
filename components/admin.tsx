"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  FlaskConical,
  Play,
  RotateCcw,
  ShieldCheck,
  Terminal,
  Users,
} from "lucide-react";
import { useApp } from "./context";
import { Badge, CheckLine, dateLabel, Empty, Stat } from "./ui";
import {
  BookingActions,
  BookingFinancials,
  BookingList,
  Timeline,
} from "./rentals";
import { day, isoDay, label, money, terminal } from "@/lib/domain";
import { scenarios } from "@/lib/scenario-catalog";
const adminLinks = [
  ["Overview", "/admin"],
  ["Users", "/admin/users"],
  ["Items", "/admin/items"],
  ["Bookings", "/admin/bookings"],
  ["Luxury approvals", "/admin/luxury"],
  ["Authentication", "/admin/authentication"],
  ["Payments", "/admin/payments"],
  ["Deposits", "/admin/deposits"],
  ["Damage claims", "/admin/claims"],
  ["Disputes", "/admin/disputes"],
  ["System simulator", "/admin/simulator"],
  ["Event logs", "/admin/events"],
];
function Gate({ children }: { children: React.ReactNode }) {
  const { actor, setActor } = useApp();
  return actor.role === "ADMIN" ? (
    children
  ) : (
    <div className="page narrow">
      <div className="panel admin-gate">
        <ShieldCheck size={36} />
        <h1>Marketplace operations.</h1>
        <p>
          Switch to the Admin demo account to manage approvals, disputes, and
          the simulator.
        </p>
        <button className="button" onClick={() => setActor("admin")}>
          Continue as Admin <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
function AdminNav({ path }: { path: string }) {
  return (
    <aside className="side-nav">
      <div className="eyebrow">MARKETPLACE OPERATIONS</div>
      {adminLinks.map(([t, h]) => (
        <Link className={path === h ? "active" : ""} key={h} href={h}>
          {t}
          {path === h && <ChevronRight size={14} />}
        </Link>
      ))}
    </aside>
  );
}
export function Admin({ path }: { path: string }) {
  const { state, mutate, busy } = useApp();
  const items = state.items.filter((i) => !i.id.startsWith("sim-")),
    pending = items.filter((i) => i.status === "PENDING_APPROVAL"),
    claims = state.bookings.filter((b) => b.claim);
  const held = state.bookings.reduce(
    (n, b) => n + (b.deposit?.status === "HELD" ? b.deposit.amount : 0),
    0,
  );
  const title = adminLinks.find(([, h]) => h === path)?.[0] || "Overview";
  return (
    <Gate>
      <div className="dashboard-layout">
        <AdminNav path={path} />
        <div className="dashboard-main">
          <div className="page-heading">
            <div>
              <div className="eyebrow">AVIELLE / OPERATIONS</div>
              <h1>{title}.</h1>
              <p>One marketplace. Every piece of the journey.</p>
            </div>
            <Link className="button" href="/admin/simulator">
              <FlaskConical size={17} /> Open simulator
            </Link>
          </div>
          {path === "/admin" && (
            <>
              <div className="stats-grid">
                <Stat label="Total users" value={state.users.length} />
                <Stat
                  label="Active listings"
                  value={
                    items.filter(
                      (i) =>
                        ![
                          "PENDING_APPROVAL",
                          "SUSPENDED",
                          "MAINTENANCE",
                        ].includes(i.status),
                    ).length
                  }
                />
                <Stat
                  label="Luxury listings"
                  value={items.filter((i) => i.tier === "LUXURY").length}
                />
                <Stat
                  label="Active rentals"
                  value={
                    state.bookings.filter((b) => !terminal.includes(b.status))
                      .length
                  }
                />
                <Stat
                  label="Simulated fee revenue"
                  value={money(
                    state.bookings
                      .filter((b) => b.status === "COMPLETED")
                      .reduce(
                        (n, b) => n + b.serviceFee + Math.round(b.rental * 0.2),
                        0,
                      ),
                  )}
                />
                <Stat label="Deposits held" value={money(held)} />
                <Stat
                  label="Open disputes"
                  value={
                    claims.filter((b) => b.claim?.dispute?.status === "OPEN")
                      .length
                  }
                />
                <Stat label="Luxury approvals" value={pending.length} />
              </div>
              <div className="panel feature-panel">
                <div>
                  <span className="eyebrow">SEE THE WHOLE PICTURE</span>
                  <h2>
                    From first request
                    <br />
                    to the next chapter.
                  </h2>
                  <p>Run seven scenarios through the real rental engine.</p>
                </div>
                <Link className="button" href="/admin/simulator">
                  Launch the simulator <Play size={15} />
                </Link>
              </div>
              <h2>All rental activity</h2>
              <BookingList all />
            </>
          )}
          {path === "/admin/bookings" && <BookingList all />}
          {path === "/admin/users" && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Role</th>
                    <th>Identity</th>
                    <th>Owner verification</th>
                    <th>Account status</th>
                  </tr>
                </thead>
                <tbody>
                  {state.users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.name}</strong>
                        <small>{u.rating.toFixed(1)} rating</small>
                      </td>
                      <td>{label(u.role)}</td>
                      <td>
                        <Badge
                          status={u.identityVerified ? "VERIFIED" : "PENDING"}
                        />
                      </td>
                      <td>
                        <button
                          className="outline-btn"
                          disabled={busy}
                          onClick={() =>
                            mutate({
                              kind: "user",
                              id: u.id,
                              data: { verified: !u.verified },
                            })
                          }
                        >
                          {u.verified ? "Verified · revoke" : "Verify owner"}
                        </button>
                      </td>
                      <td>
                        <button
                          className="outline-btn"
                          disabled={busy || u.role === "ADMIN"}
                          onClick={() =>
                            mutate({
                              kind: "user",
                              id: u.id,
                              data: { active: !u.active },
                            })
                          }
                        >
                          {u.active
                            ? "Active · suspend"
                            : "Suspended · restore"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {["/admin/luxury", "/admin/authentication", "/admin/items"].includes(
            path,
          ) && (
            <div className="listing-list">
              {(path === "/admin/luxury"
                ? pending
                : path === "/admin/authentication"
                  ? items.filter((i) => i.tier === "LUXURY")
                  : items
              ).map((i) => (
                <div className="listing-row" key={i.id}>
                  <img src={JSON.parse(i.images)[0]} alt="" />
                  <div>
                    <strong>{i.title}</strong>
                    <small>
                      {i.owner.name} · {i.tier}
                    </small>
                    <Badge status={i.authenticationStatus} />
                  </div>
                  <Badge status={i.status} />
                  <div className="stack">
                    {i.tier === "LUXURY" &&
                      i.authenticationStatus !== "VERIFIED" && (
                        <button
                          className="outline-btn"
                          disabled={busy}
                          onClick={() =>
                            mutate({ kind: "authenticate", id: i.id })
                          }
                        >
                          Authenticate item
                        </button>
                      )}
                    {i.status === "PENDING_APPROVAL" && (
                      <button
                        className="button"
                        disabled={busy}
                        onClick={() =>
                          mutate({ kind: "item", id: i.id, action: "approve" })
                        }
                      >
                        Approve listing
                      </button>
                    )}
                    <button
                      className="text-link"
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
                      {i.status === "SUSPENDED"
                        ? "Restore listing"
                        : "Suspend / reject"}
                    </button>
                  </div>
                </div>
              ))}
              {path === "/admin/luxury" && !pending.length && (
                <Empty
                  title="All caught up."
                  body="New luxury listings will appear here for authentication and approval."
                />
              )}
            </div>
          )}
          {["/admin/claims", "/admin/disputes"].includes(path) &&
            claims.map((b) => (
              <div className="panel" key={b.id}>
                <div className="page-heading">
                  <div>
                    <h2>{b.item.title}</h2>
                    <p>{b.claim?.description}</p>
                    <p>
                      {b.renter.name} · {money(b.claim?.amount || 0)} claimed
                    </p>
                  </div>
                  <Badge status={b.claim?.status || "OPEN"} />
                </div>
                <div className="report-grid">
                  {b.reports.map((r) => (
                    <div key={r.id}>
                      <span className="eyebrow">{r.phase}</span>
                      <h3>{r.condition}</h3>
                      <p>{r.notes}</p>
                      {JSON.parse(r.photos).map((im: string, n: number) => (
                        <img src={im} alt="Condition evidence" key={n} />
                      ))}
                    </div>
                  ))}
                </div>
                {b.claim?.dispute && (
                  <p>Renter’s statement: {b.claim.dispute.reason}</p>
                )}
                <BookingActions booking={b} />
                <Link className="text-link" href={`/bookings/${b.id}`}>
                  Full evidence & financial record <ArrowRight size={15} />
                </Link>
              </div>
            ))}
          {["/admin/payments", "/admin/deposits"].includes(path) && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rental</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>
                      {path.endsWith("payments") ? "Refunded" : "Captured"}
                    </th>
                    <th>{path.endsWith("payments") ? "Action" : "Released"}</th>
                  </tr>
                </thead>
                <tbody>
                  {state.bookings.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <Link href={`/bookings/${b.id}`}>{b.item.title}</Link>
                        <small>{b.id.slice(-8)}</small>
                      </td>
                      <td>
                        <Badge
                          status={
                            (path.endsWith("payments")
                              ? b.payment?.status
                              : b.deposit?.status) || "PENDING"
                          }
                        />
                      </td>
                      <td>
                        {money(
                          path.endsWith("payments")
                            ? b.payment?.amount || 0
                            : b.depositAmount,
                        )}
                      </td>
                      <td>
                        {money(
                          path.endsWith("payments")
                            ? b.payment?.refunded || 0
                            : b.deposit?.captured || 0,
                        )}
                      </td>
                      <td>
                        {path.endsWith("payments") ? (
                          <button
                            className="outline-btn"
                            disabled={
                              busy ||
                              !["CAPTURED", "PARTIALLY_REFUNDED"].includes(
                                b.payment?.status || "",
                              ) ||
                              !!b.payout
                            }
                            onClick={() =>
                              mutate({
                                kind: "booking",
                                id: b.id,
                                action: "refund",
                                data: {
                                  amount:
                                    (b.payment?.amount || 0) -
                                    (b.payment?.refunded || 0),
                                },
                              })
                            }
                          >
                            Refund remaining
                          </button>
                        ) : (
                          money(b.deposit?.released || 0)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {path === "/admin/events" && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Virtual time</th>
                    <th>Event</th>
                    <th>Actor</th>
                    <th>Transition</th>
                  </tr>
                </thead>
                <tbody>
                  {state.events.map((e) => (
                    <tr key={e.id}>
                      <td>
                        {new Date(e.simulatedAt).toLocaleString("en-GB", {
                          timeZone: "UTC",
                        })}
                      </td>
                      <td>
                        <strong>{label(e.type)}</strong>
                        <details>
                          <summary>Metadata</summary>
                          <pre>{e.metadata}</pre>
                        </details>
                      </td>
                      <td>
                        {state.users.find((u) => u.id === e.actor)?.name ||
                          e.actor}
                      </td>
                      <td>
                        {e.oldState &&
                          `${label(e.oldState)} → ${label(e.newState)}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Gate>
  );
}
export function Simulator() {
  const { state, actor, mutate, busy } = useApp();
  const [scenarioId, setScenario] = useState("luxury"),
    [debug, setDebug] = useState(true);
  const session = state.sessions.find((s) => s.id === scenarioId),
    b = state.bookings.find((b) => b.id === session?.bookingId),
    scenario = scenarios.find((s) => s.id === scenarioId)!;
  const inject = async (type: string) => {
    if (!b) return;
    if (type === "IDENTITY" || type === "IDENTITY_OK")
      await mutate({
        kind: "verify",
        id: b.renterId,
        data: { fail: type === "IDENTITY" },
      });
    else if (type === "AUTH" || type === "AUTH_OK")
      await mutate({
        kind: "authenticate",
        id: b.itemId,
        data: { fail: type === "AUTH" },
      });
    else if (type === "LATE")
      await mutate({
        kind: "clock",
        data: {
          target: new Date(
            Math.max(
              Date.parse(state.clock.now) + day,
              Date.parse(b.endDate) + day + 7 * 3600000,
            ),
          ).toISOString(),
        },
      });
    else
      await mutate({
        kind: "booking",
        id: b.id,
        action:
          type === "PAYMENT" || type === "DEPOSIT"
            ? "pay"
            : type === "DELAY"
              ? "delay"
              : type === "REJECT"
                ? "reject"
                : "damage",
        data: {
          fail: type === "PAYMENT",
          failure: type === "DEPOSIT" ? "DEPOSIT" : undefined,
        },
      });
  };
  return (
    <Gate>
      <div className="simulator-page">
        <div className="sim-header">
          <div>
            <Link className="back-link" href="/admin">
              <ArrowRight size={14} className="rotate" /> Back to operations
            </Link>
            <div className="eyebrow">THE WHOLE JOURNEY, IN YOUR HANDS</div>
            <h1>
              System simulator
              <span className="live-label">
                <span /> Live engine
              </span>
            </h1>
            <p>
              Real marketplace rules. A clock you control. No waiting required.
            </p>
          </div>
          <div className="sim-clock">
            <Clock3 size={20} />
            <div>
              <small>PLATFORM TIME · UTC</small>
              <strong>
                {new Date(state.clock.now).toLocaleString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "UTC",
                })}
              </strong>
            </div>
          </div>
        </div>
        <div className="scenario-bar">
          <label>
            Current scenario
            <select
              value={scenarioId}
              onChange={(e) => setScenario(e.target.value)}
            >
              {scenarios.map((s, i) => (
                <option key={s.id} value={s.id}>
                  {String(i + 1).padStart(2, "0")} · {s.name}
                </option>
              ))}
            </select>
          </label>
          <p>{scenario.description}</p>
          <button
            className="outline-btn"
            disabled={busy}
            onClick={() => mutate({ kind: "scenario", id: scenarioId })}
          >
            <RotateCcw size={16} /> Reset scenario
          </button>
        </div>
        {b ? (
          <>
            <div className="state-grid">
              <Stat
                label="Booking"
                value={<Badge status={b.status} />}
                detail={b.overdue ? "Return overdue" : `Scenario ${scenarioId}`}
              />
              <Stat
                label="Item"
                value={<Badge status={b.item.status} />}
                detail={
                  b.item.tier === "LUXURY"
                    ? "Luxury collection"
                    : "Everyday collection"
                }
              />
              <Stat
                label="Payment"
                value={<Badge status={b.payment?.status || "PENDING"} />}
                detail={money(b.payment?.amount || 0)}
              />
              <Stat
                label="Deposit"
                value={<Badge status={b.deposit?.status || "PENDING"} />}
                detail={`${money(b.depositAmount)} security deposit`}
              />
              <Stat
                label="Delivery"
                value={<Badge status={b.delivery?.status || "NOT_STARTED"} />}
                detail={label(b.delivery?.method || "")}
              />
            </div>
            <div className="sim-layout">
              <div>
                <div className="panel actors-panel">
                  <div className="panel-heading">
                    <h3>
                      <Users size={18} /> The people & the piece
                    </h3>
                    <Badge status={b.item.tier} />
                  </div>
                  <div className="sim-item">
                    <img
                      src={JSON.parse(b.item.images)[0]}
                      alt={b.item.title}
                    />
                    <div>
                      <span className="eyebrow">{b.item.brand}</span>
                      <h2>{b.item.title}</h2>
                      <p>
                        {dateLabel(b.startDate)} – {dateLabel(b.endDate)} ·{" "}
                        {b.days} days
                      </p>
                      <div className="sim-people">
                        <span>
                          <span className="avatar small">S</span>{" "}
                          {b.renter.name} <small>Renter</small>
                        </span>
                        <span>
                          <span className="avatar small owner">
                            {b.item.owner.name[0]}
                          </span>{" "}
                          {b.item.owner.name} <small>Owner</small>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="panel">
                  <div className="panel-heading">
                    <h3>
                      <Play size={18} /> Available next actions
                    </h3>
                    <span className="small muted">Enforced transitions</span>
                  </div>
                  {["COMPLETED", "REJECTED", "CANCELLED"].includes(
                    b.status,
                  ) && (
                    <div className="scenario-finished">
                      <Check size={26} />
                      <h3>
                        {b.status === "COMPLETED"
                          ? "A complete rental journey."
                          : "This booking is closed."}
                      </h3>
                      <p>
                        Review the timeline or reset to try a different outcome.
                      </p>
                    </div>
                  )}
                  <BookingActions key={b.id} booking={b} simulator />
                </div>
                {b.item.tier === "LUXURY" && (
                  <div className="panel">
                    <h3>
                      <ShieldCheck size={18} /> Luxury eligibility
                    </h3>
                    <div className="checks-grid">
                      <CheckLine ok={b.renter.identityVerified}>
                        Identity verified
                      </CheckLine>
                      <CheckLine
                        ok={b.item.authenticationStatus === "VERIFIED"}
                      >
                        Authenticity verified
                      </CheckLine>
                      <CheckLine ok={b.item.owner.verified}>
                        Owner verified
                      </CheckLine>
                      <CheckLine
                        ok={b.renter.rating >= b.item.minimumRenterRating}
                      >
                        Renter rating eligible
                      </CheckLine>
                      <CheckLine
                        ok={
                          b.deposit?.status === "HELD" ||
                          ["COMPLETED", "RESOLVED"].includes(b.status)
                        }
                      >
                        Deposit authorized
                      </CheckLine>
                      <CheckLine
                        ok={b.history.some((h) => h.newState === "APPROVED")}
                      >
                        Owner approval received
                      </CheckLine>
                    </div>
                  </div>
                )}
                <div className="panel">
                  <h3>
                    <Clock3 size={18} /> Move time forward
                  </h3>
                  <div className="clock-actions">
                    {[1, 24, 72].map((h) => (
                      <button
                        className="outline-btn"
                        key={h}
                        disabled={busy}
                        onClick={() =>
                          mutate({ kind: "clock", data: { hours: h } })
                        }
                      >
                        +{h === 1 ? "1 hour" : h === 24 ? "1 day" : "3 days"}
                      </button>
                    ))}
                    <button
                      className="outline-btn"
                      disabled={
                        busy ||
                        Date.parse(b.startDate) < Date.parse(state.clock.now)
                      }
                      onClick={() =>
                        mutate({
                          kind: "clock",
                          data: { target: new Date(b.startDate).toISOString() },
                        })
                      }
                    >
                      Rental start
                    </button>
                    <button
                      className="outline-btn"
                      disabled={
                        busy ||
                        Date.parse(b.endDate) + day <
                          Date.parse(state.clock.now)
                      }
                      onClick={() =>
                        mutate({
                          kind: "clock",
                          data: {
                            target: new Date(
                              Date.parse(b.endDate) + day,
                            ).toISOString(),
                          },
                        })
                      }
                    >
                      Return deadline
                    </button>
                  </div>
                  <p className="small muted">
                    Shared platform clock. Reminders, overdue flags, and daily
                    late fees update across all bookings.
                  </p>
                </div>
                <div className="panel debug-panel">
                  <button
                    className="panel-heading"
                    onClick={() => setDebug(!debug)}
                  >
                    <h3>
                      <Terminal size={18} /> Failure controls
                    </h3>
                    <span>{debug ? "−" : "+"}</span>
                  </button>
                  {debug && (
                    <>
                      <p className="muted">
                        Inject a service failure at the appropriate step.
                        Eligibility failures block payment until restored.
                      </p>
                      <div className="debug-actions">
                        {[
                          [
                            "PAYMENT",
                            "Fail payment",
                            ["PAYMENT_PENDING", "PAYMENT_FAILED"].includes(
                              b.status,
                            ),
                          ],
                          [
                            "DEPOSIT",
                            "Fail deposit",
                            ["PAYMENT_PENDING", "PAYMENT_FAILED"].includes(
                              b.status,
                            ),
                          ],
                          [
                            "IDENTITY",
                            "Fail identity",
                            b.item.tier === "LUXURY",
                          ],
                          [
                            "IDENTITY_OK",
                            "Restore identity",
                            !b.renter.identityVerified,
                          ],
                          [
                            "AUTH",
                            "Fail authentication",
                            b.item.tier === "LUXURY",
                          ],
                          [
                            "AUTH_OK",
                            "Restore authentication",
                            b.item.authenticationStatus !== "VERIFIED",
                          ],
                          [
                            "DELAY",
                            "Delay delivery",
                            ["SHIPPED", "READY_FOR_PICKUP"].includes(b.status),
                          ],
                          [
                            "REJECT",
                            "Owner rejects",
                            b.status === "AWAITING_APPROVAL",
                          ],
                          [
                            "DAMAGE",
                            "Discover damage",
                            b.status === "INSPECTION",
                          ],
                          [
                            "LATE",
                            "Make return overdue",
                            [
                              "DELIVERED",
                              "RENTAL_ACTIVE",
                              "RETURN_REQUESTED",
                              "RETURN_IN_TRANSIT",
                            ].includes(b.status),
                          ],
                        ].map(([id, t, enabled]) => (
                          <button
                            className="outline-btn"
                            key={String(id)}
                            disabled={busy || !enabled}
                            onClick={() => inject(String(id))}
                          >
                            {String(t)}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <aside>
                <div className="panel timeline-panel">
                  <div className="panel-heading">
                    <h3>
                      <Activity size={18} /> Event timeline
                    </h3>
                    <span className="count-badge">
                      {state.events.filter((e) => e.entityId === b.id).length}
                    </span>
                  </div>
                  <Timeline id={b.id} />
                </div>
                <div className="panel">
                  <h3>Financial breakdown</h3>
                  <BookingFinancials booking={b} />
                </div>
                <Link className="text-link" href={`/bookings/${b.id}`}>
                  Open the customer rental view <ArrowRight size={15} />
                </Link>
              </aside>
            </div>
          </>
        ) : (
          <Empty
            title="Start this scenario"
            body="Select Reset scenario to create its initial booking."
          />
        )}
      </div>
    </Gate>
  );
}
