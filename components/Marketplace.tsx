"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ChevronDown,
  FlaskConical,
  Loader2,
  Menu,
  Search,
  ShoppingBag,
  X,
} from "lucide-react";
import type { Snapshot } from "@/lib/snapshot";
import { Context, type Mutation } from "./context";
import { Home, Explore, Influencers } from "./discovery";
import { ItemDetail } from "./item";
import { BookingDetail, Rentals, Messages, Notifications } from "./rentals";
import { Dashboard, ListingForm } from "./dashboard";
import { Admin, Simulator } from "./admin";

export default function Marketplace() {
  const path = usePathname();
  const [state, setState] = useState<Snapshot | null>(null),
    [actorId, setActorId] = useState("sara"),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState<{ text: string; error: boolean } | null>(null),
    [fatal, setFatal] = useState(""),
    [menu, setMenu] = useState(false);
  const refresh = useCallback(async () => {
    const r = await fetch("/api/state", { cache: "no-store" });
    if (!r.ok)
      throw new Error(
        "Unable to load the marketplace. Run database setup, then refresh.",
      );
    setState(await r.json());
  }, []);
  useEffect(() => {
    setActorId(localStorage.getItem("avielle-actor") || "sara");
    refresh().catch((e) => setFatal(e.message));
    const onFocus = () => refresh().catch(() => {});
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);
  useEffect(() => {
    setMenu(false);
  }, [path]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 6500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  const setActor = (id: string) => {
    setActorId(id);
    localStorage.setItem("avielle-actor", id);
  };
  const mutate = async (input: Mutation) => {
    setBusy(true);
    try {
      const r = await fetch("/api/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, actor: actorId }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      await refresh();
      setToast({
        text:
          input.kind === "scenario"
            ? "Scenario restored and ready to run."
            : "Saved. Your marketplace is up to date.",
        error: false,
      });
      return result.result;
    } catch (e) {
      setToast({
        text: e instanceof Error ? e.message : "Something went wrong.",
        error: true,
      });
      return null;
    } finally {
      setBusy(false);
    }
  };
  if (!state)
    return (
      <div className="loading">
        <span className="wordmark">AVIELLE</span>
        {fatal ? (
          <>
            <p>{fatal}</p>
            <button onClick={() => location.reload()}>Try again</button>
          </>
        ) : (
          <>
            <Loader2 className="spin" />
            <p>Opening your shared wardrobe…</p>
          </>
        )}
      </div>
    );
  const actor = state.users.find((u) => u.id === actorId) || state.users[0];
  const unread = state.notifications.filter(
    (n) => n.userId === actor.id && !n.read,
  ).length;
  let page: React.ReactNode;
  if (path === "/") page = <Home />;
  else if (["/explore", "/luxury", "/everyday"].includes(path))
    page = (
      <Explore
        key={path}
        tier={
          path === "/luxury" ? "LUXURY" : path === "/everyday" ? "NORMAL" : ""
        }
      />
    );
  else if (path.startsWith("/influencers")) page = <Influencers />;
  else if (path.startsWith("/items/") || path.startsWith("/checkout/"))
    page = (
      <ItemDetail
        key={path}
        id={path.split("/")[2]}
        checkout={path.startsWith("/checkout/")}
      />
    );
  else if (path.startsWith("/bookings/"))
    page = <BookingDetail id={path.split("/")[2]} />;
  else if (path === "/admin/simulator") page = <Simulator />;
  else if (path.startsWith("/admin")) page = <Admin path={path} />;
  else if (path === "/dashboard/new" || path === "/list")
    page = <ListingForm />;
  else if (path === "/dashboard/messages") page = <Messages />;
  else if (path === "/dashboard/notifications") page = <Notifications />;
  else if (path === "/dashboard/rentals") page = <Rentals />;
  else if (path.startsWith("/dashboard")) page = <Dashboard path={path} />;
  else
    page = (
      <div className="page empty">
        <h1>That page has moved.</h1>
        <Link href="/explore">Explore the wardrobe</Link>
      </div>
    );
  return (
    <Context.Provider value={{ state, actor, setActor, mutate, busy, refresh }}>
      <div className="announcement">
        A little less ownership. A lot more possibility.{" "}
        <Link href="/explore">
          Discover rental <ArrowRight size={12} />
        </Link>
      </div>
      <header>
        <div className="header-inner">
          <Link className="wordmark" href="/">
            AVIELLE<span>THE SHARED WARDROBE</span>
          </Link>
          <nav className={menu ? "open" : ""}>
            {[
              ["Explore", "/explore"],
              ["Luxury", "/luxury"],
              ["Everyday", "/everyday"],
              ["Influencer closets", "/influencers"],
            ].map(([text, url]) => (
              <Link
                className={path === url ? "active" : ""}
                href={url}
                key={url}
              >
                {text}
              </Link>
            ))}
          </nav>
          <div className="header-actions">
            <Link
              className="icon-btn"
              aria-label="Search the wardrobe"
              href="/explore"
            >
              <Search size={20} />
            </Link>
            <Link
              className="icon-btn notification-icon"
              aria-label={`${unread} notifications`}
              href="/dashboard/notifications"
            >
              <Bell size={20} />
              {unread > 0 && <i />}
            </Link>
            <Link
              className="icon-btn"
              aria-label="My rentals"
              href="/dashboard/rentals"
            >
              <ShoppingBag size={20} />
            </Link>
            <Link className="outline-btn list-link" href="/dashboard/new">
              List an item <ArrowUpRight size={15} />
            </Link>
            <button
              className="icon-btn mobile-menu"
              aria-label="Toggle navigation"
              onClick={() => setMenu(!menu)}
            >
              <Menu />
            </button>
          </div>
        </div>
      </header>
      <div className="demo-toolbar">
        <div>
          <span className="demo-pill">INTERACTIVE DEMO</span>
          <span className="demo-description">
            Real journeys. Simulated services.
          </span>
        </div>
        <div>
          <Link href="/admin/simulator">
            <FlaskConical size={14} /> System simulator
          </Link>
          <span className="toolbar-divider" />
          <label className="role-switch">
            <span className="avatar small">{actor.name[0]}</span>
            <select
              aria-label="Demo account"
              value={actor.id}
              onChange={(e) => setActor(e.target.value)}
            >
              {state.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name.split(" ")[0]} ·{" "}
                  {u.role === "INFLUENCER"
                    ? "Luxury owner"
                    : u.role.toLowerCase()}
                </option>
              ))}
            </select>
            <ChevronDown size={13} />
          </label>
          <Link className="dashboard-link" href="/dashboard">
            Dashboard
          </Link>
        </div>
      </div>
      <main>{page}</main>
      <footer>
        <div className="footer-main">
          <div>
            <Link className="wordmark" href="/">
              AVIELLE
            </Link>
            <p>
              Great style deserves
              <br />
              more than one moment.
            </p>
          </div>
          <div>
            <span>THE WARDROBE</span>
            <Link href="/explore">Explore all pieces</Link>
            <Link href="/luxury">The luxury edit</Link>
            <Link href="/influencers">Influencer closets</Link>
          </div>
          <div>
            <span>MAKE IT YOURS</span>
            <Link href="/dashboard/rentals">My rentals</Link>
            <Link href="/dashboard/new">Become a lender</Link>
            <Link href="/admin/simulator">Explore the simulator</Link>
          </div>
          <div className="footer-note">
            <span>A MORE CONSIDERED CLOSET</span>
            <p>
              Wear what you love.
              <br />
              Share what you own.
            </p>
            <ArrowUpRight size={25} />
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 AVIELLE. A fashion rental prototype.</span>
          <span>
            Payments, verification, shipping & insurance are simulated.
          </span>
        </div>
      </footer>
      {toast && (
        <div
          role={toast.error ? "alert" : "status"}
          className={`toast ${toast.error ? "error" : ""}`}
        >
          <CheckCircle2 size={19} />
          <span>{toast.text}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {busy && <div className="busy-bar" />}
    </Context.Provider>
  );
}
