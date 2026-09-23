import { db } from "./db";
import { bookingInclude } from "./services";
export async function snapshot() {
  const [users, items, bookings, events, notifications, sessions, clock] =
    await Promise.all([
      db.user.findMany(),
      db.item.findMany({
        include: { owner: true },
        orderBy: { createdAt: "asc" },
      }),
      db.booking.findMany({
        include: bookingInclude,
        orderBy: { createdAt: "desc" },
      }),
      db.platformEvent.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
      db.notification.findMany({
        orderBy: [{ simulatedAt: "desc" }, { id: "desc" }],
      }),
      db.simulatorSession.findMany(),
      db.platformClock.findUniqueOrThrow({ where: { id: "clock" } }),
    ]);
  return { users, items, bookings, events, notifications, sessions, clock };
}
export type Snapshot = Awaited<ReturnType<typeof snapshot>>;
export type CatalogItem = Snapshot["items"][number];
