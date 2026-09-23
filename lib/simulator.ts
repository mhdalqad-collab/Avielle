import { Prisma } from "@prisma/client";
import {
  advanceClock,
  bookingAction,
  emit,
  now,
  requestBooking,
  requireAdmin,
} from "./services";
import { day, isoDay } from "./domain";
import { scenarios } from "./scenario-catalog";
export async function resetScenario(
  tx: Prisma.TransactionClient,
  id: string,
  actor: string,
) {
  await requireAdmin(tx, actor);
  const scenario = scenarios.find((s) => s.id === id);
  if (!scenario) throw new Error("Choose a known scenario.");
  const previous = await tx.booking.findMany({ where: { scenarioId: id } });
  for (const b of previous) {
    await tx.notification.deleteMany({ where: { bookingId: b.id } });
    await tx.platformEvent.deleteMany({ where: { entityId: b.id } });
    await tx.booking.delete({ where: { id: b.id } });
  }
  const source = await tx.item.findUniqueOrThrow({
    where: { id: scenario.itemId },
  });
  const clone = {
    ...source,
    id: `sim-${id}`,
    status: "ACTIVE",
    authenticationStatus:
      source.tier === "LUXURY" ? "VERIFIED" : "NOT_REQUIRED",
    availableFrom: isoDay(await now(tx)),
    availableTo: "2035-12-31",
  };
  await tx.item.upsert({
    where: { id: clone.id },
    create: clone,
    update: clone,
  });
  await tx.user.update({
    where: { id: "sara" },
    data: { identityVerified: true, active: true },
  });
  const start = isoDay(await now(tx)),
    end = isoDay(new Date(Date.parse(start) + 2 * day).toISOString());
  const b = await requestBooking(
    tx,
    {
      itemId: clone.id,
      renterId: "sara",
      startDate: start,
      endDate: end,
      method: "PLATFORM_COURIER",
      insurance: clone.insuranceRequired,
      scenarioId: id,
    },
    actor,
  );
  if (["damage", "late", "cancel"].includes(id)) {
    if (source.approvalRequired)
      await bookingAction(tx, b.id, "approve", actor);
    await bookingAction(tx, b.id, "pay", actor);
    if (id !== "cancel")
      for (const action of ["prepare", "ship", "deliver", "start"])
        await bookingAction(tx, b.id, action, actor);
    if (id === "damage")
      for (const action of [
        "return",
        "returnShip",
        "receive",
        "inspect",
        "damage",
        "dispute",
      ])
        await bookingAction(tx, b.id, action, actor);
    if (id === "late") await advanceClock(tx, actor, 80);
  }
  await tx.simulatorSession.upsert({
    where: { id },
    create: { id, name: scenario.name, bookingId: b.id },
    update: { bookingId: b.id },
  });
  await emit(tx, "SCENARIO_RESET", b.id, actor, { scenario: id });
  return b.id;
}
