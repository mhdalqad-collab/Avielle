import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  advanceClock,
  bookingAction,
  bookingInclude,
  createListing,
  PaymentSimulator,
  requestBooking,
  runTransaction,
} from "../lib/services";
import { resetScenario } from "../lib/simulator";
const dir = mkdtempSync(path.join(tmpdir(), "avielle-test-")),
  file = path.join(dir, "test.db");
const sqlite = new DatabaseSync(file);
for (const f of readdirSync("prisma/migrations").filter(
  (f) => f !== "migration_lock.toml",
))
  sqlite.exec(
    readFileSync(path.join("prisma/migrations", f, "migration.sql"), "utf8"),
  );
sqlite.close();
const db = new PrismaClient({
  datasources: { db: { url: `file:${file.replaceAll("\\", "/")}` } },
});
const tx = <T>(f: Parameters<typeof runTransaction<T>>[0]) =>
  runTransaction(f, db);
const act = (
  id: string,
  action: string,
  options: Parameters<typeof bookingAction>[4] = {},
  actor = "admin",
) => tx((t) => bookingAction(t, id, action, actor, options));
const book = (luxury = false, start = "2026-10-01", end = "2026-10-03") =>
  tx((t) =>
    requestBooking(
      t,
      {
        itemId: luxury ? "item-23" : "item-1",
        renterId: "sara",
        startDate: start,
        endDate: end,
        method: "OWNER_SHIPPING",
        insurance: luxury,
      },
      "sara",
    ),
  );
async function toInspection(luxury = false) {
  const b = await book(luxury);
  if (luxury) await act(b.id, "approve");
  for (const a of [
    "pay",
    "prepare",
    "ship",
    "deliver",
    "start",
    "return",
    "returnShip",
    "receive",
    "inspect",
  ])
    await act(b.id, a);
  return b;
}
beforeEach(async () => {
  await db.booking.deleteMany();
  await db.item.deleteMany();
  await db.user.deleteMany();
  await db.notification.deleteMany();
  await db.platformEvent.deleteMany();
  await db.simulatorSession.deleteMany();
  await db.platformClock.upsert({
    where: { id: "clock" },
    create: { id: "clock", now: "2026-10-01T10:00:00Z" },
    update: { now: "2026-10-01T10:00:00Z" },
  });
  for (const [id, role] of [
    ["sara", "RENTER"],
    ["daniel", "OWNER"],
    ["lina", "INFLUENCER"],
    ["admin", "ADMIN"],
    ["outsider", "RENTER"],
  ])
    await db.user.create({
      data: {
        id,
        name: id,
        role,
        avatar: "",
        identityVerified: true,
        verified: true,
        rating: 4.9,
      },
    });
  const base = {
    title: "Navy suit",
    description: "A carefully cared for suit.",
    brand: "COS",
    category: "Suits",
    tier: "NORMAL",
    size: "M",
    color: "Navy",
    replacementValue: 45000,
    rentalPricePerDay: 3500,
    securityDeposit: 10000,
    images: '["/images/suit.jpg"]',
    availableFrom: "2026-01-01",
    availableTo: "2030-12-31",
  };
  for (const id of ["item-1", "item-2", "item-3", "item-4"])
    await db.item.create({ data: { ...base, id, ownerId: "daniel" } });
  for (const id of ["item-23", "item-24", "item-25"])
    await db.item.create({
      data: {
        ...base,
        id,
        title: "Designer bag",
        ownerId: "lina",
        tier: "LUXURY",
        rentalPricePerDay: 18000,
        securityDeposit: 150000,
        authenticationStatus: "VERIFIED",
        approvalRequired: true,
        insuranceRequired: true,
        identityVerificationRequired: true,
        minimumRenterRating: 4,
      },
    });
});
after(async () => {
  await db.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

test("concurrent requests cannot double-book the same dates", async () => {
  const results = await Promise.allSettled([book(), book()]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(await db.booking.count(), 1);
});

test("delivery delay persists and blocks confirmation until the virtual clock passes it", async () => {
  const b = await book();
  for (const action of ["pay", "prepare", "ship", "delay"])
    await act(b.id, action);
  const delayed = await db.delivery.findUniqueOrThrow({
    where: { bookingId: b.id },
  });
  assert.equal(delayed.status, "DELAYED");
  assert.ok(delayed.delayedUntil);
  await assert.rejects(() => act(b.id, "deliver"), /Delivery delayed/);
  await tx((t) => advanceClock(t, "admin", 24));
  assert.equal((await act(b.id, "deliver")).status, "DELIVERED");
});

test("future cancellation does not reset an item that is currently rented", async () => {
  const current = await book();
  for (const action of ["pay", "prepare", "ship", "deliver", "start"])
    await act(current.id, action);
  const future = await book(false, "2026-10-05", "2026-10-07");
  await act(future.id, "pay");
  assert.equal(
    (await db.item.findUniqueOrThrow({ where: { id: "item-1" } })).status,
    "RENTED",
  );
  await act(future.id, "cancel");
  assert.equal(
    (await db.item.findUniqueOrThrow({ where: { id: "item-1" } })).status,
    "RENTED",
  );
});

test("completion preserves an administrative listing suspension", async () => {
  const b = await toInspection();
  await db.item.update({
    where: { id: b.itemId },
    data: { status: "SUSPENDED" },
  });
  const completed = await act(b.id, "pass");
  assert.equal(completed.item.status, "SUSPENDED");
});

test("rejection cancels a pending deposit without inventing a returned payment", async () => {
  const b = await book(true);
  const rejected = await act(b.id, "reject");
  assert.equal(rejected.status, "REJECTED");
  assert.equal(rejected.deposit?.status, "RELEASED");
  assert.equal(rejected.deposit?.released, 0);
});

test("normal and luxury listings persist with the correct approval and authentication policy", async () => {
  const data = {
    title: "A lovely dress",
    description: "A red occasion dress in excellent condition.",
    brand: "Studio",
    category: "Dresses",
    tier: "NORMAL",
    size: "M",
    color: "Red",
    condition: "Excellent",
    replacementValue: 40000,
    rentalPricePerDay: 2000,
    securityDeposit: 10000,
    location: "Berlin",
    deliveryOptions: "LOCAL_PICKUP",
    approvalRequired: false,
    availableFrom: "2026-10-01",
    availableTo: "2027-10-01",
    images: '["/images/dress.jpg"]',
  };
  const normal = await tx((t) => createListing(t, "daniel", data));
  assert.equal(normal.status, "ACTIVE");
  const luxury = await tx((t) =>
    createListing(t, "lina", { ...data, tier: "LUXURY" }),
  );
  assert.equal(luxury.status, "PENDING_APPROVAL");
  assert.equal(luxury.authenticationStatus, "PENDING");
  await assert.rejects(
    () => tx((t) => createListing(t, "sara", data)),
    /owner account/,
  );
  await assert.rejects(
    () =>
      tx((t) =>
        createListing(t, "daniel", { ...data, availableFrom: "not-a-date" }),
      ),
    /valid rental dates/,
  );
});
test("normal booking persists payment, deposit, delivery, history, and audit events", async () => {
  const b = await book();
  assert.equal(b.status, "PAYMENT_PENDING");
  assert.equal(b.total, 22350);
  const stored = await db.booking.findUniqueOrThrow({
    where: { id: b.id },
    include: bookingInclude,
  });
  assert.equal(stored.payment?.status, "PENDING");
  assert.equal(stored.deposit?.amount, 10000);
  assert.ok(stored.delivery?.tracking.startsWith("AVIELLE-"));
  assert.equal(stored.history.length, 1);
  assert.equal(await db.platformEvent.count({ where: { entityId: b.id } }), 2);
});
test("overlapping pending or confirmed booking rejected; adjacent dates accepted", async () => {
  await book();
  await assert.rejects(
    () => book(false, "2026-10-03", "2026-10-06"),
    /overlap/,
  );
  await book(false, "2026-10-04", "2026-10-06");
  assert.equal(await db.booking.count(), 2);
});
test("cancelled bookings release inventory dates", async () => {
  const b = await book();
  await act(b.id, "cancel");
  await book();
  assert.equal(await db.booking.count(), 2);
});
test("luxury identity, authentication, rating, owner verification and insurance gates", async () => {
  await db.user.update({
    where: { id: "sara" },
    data: { identityVerified: false },
  });
  await assert.rejects(() => book(true), /identity/);
  await db.user.update({
    where: { id: "sara" },
    data: { identityVerified: true, rating: 3 },
  });
  await assert.rejects(() => book(true), /rating/);
  await db.user.update({ where: { id: "sara" }, data: { rating: 4.9 } });
  await db.item.update({
    where: { id: "item-23" },
    data: { authenticationStatus: "PENDING" },
  });
  await assert.rejects(() => book(true), /authentication/);
  await db.item.update({
    where: { id: "item-23" },
    data: { authenticationStatus: "VERIFIED" },
  });
  await db.user.update({ where: { id: "lina" }, data: { verified: false } });
  await assert.rejects(() => book(true), /owner verification/);
  await db.user.update({ where: { id: "lina" }, data: { verified: true } });
  await assert.rejects(
    () =>
      tx((t) =>
        requestBooking(
          t,
          {
            itemId: "item-23",
            renterId: "sara",
            startDate: "2026-10-01",
            endDate: "2026-10-03",
            method: "LOCAL_PICKUP",
          },
          "sara",
        ),
      ),
    /insurance/,
  );
  assert.equal((await book(true)).status, "AWAITING_APPROVAL");
});
test("owner approval cannot be bypassed with payment", async () => {
  const b = await book(true);
  await assert.rejects(() => act(b.id, "pay"), /Cannot move/);
  await act(b.id, "approve", {}, "lina");
  assert.equal((await act(b.id, "pay", {}, "sara")).status, "CONFIRMED");
});
test("payment failure persists and retry authorizes the deposit once", async () => {
  const b = await book();
  const failed = await act(b.id, "pay", { fail: true });
  assert.equal(failed.status, "PAYMENT_FAILED");
  assert.equal(failed.payment?.status, "FAILED");
  assert.equal(failed.deposit?.status, "PENDING");
  const paid = await act(b.id, "pay");
  assert.equal(paid.status, "CONFIRMED");
  assert.equal(paid.payment?.status, "CAPTURED");
  assert.equal(paid.deposit?.status, "HELD");
  await assert.rejects(() => act(b.id, "pay"), /Cannot move/);
  assert.equal(
    await db.platformEvent.count({
      where: { type: "DEPOSIT_AUTHORIZED", entityId: b.id },
    }),
    1,
  );
});
test("deposit authorization failure leaves the booking unconfirmed", async () => {
  const b = await book();
  const failed = await act(b.id, "pay", { failure: "DEPOSIT" });
  assert.equal(failed.status, "PAYMENT_FAILED");
  assert.equal(failed.deposit?.status, "PENDING");
  assert.equal((await act(b.id, "pay")).deposit?.status, "HELD");
});
test("normal successful lifecycle releases deposit and pays owner exactly once", async () => {
  const b = await toInspection();
  const completed = await act(b.id, "pass");
  assert.equal(completed.status, "COMPLETED");
  assert.equal(completed.deposit?.status, "RELEASED");
  assert.equal(completed.deposit?.released, 10000);
  assert.equal(completed.payout?.amount, 8400);
  assert.equal(completed.reports.length, 2);
  assert.equal(completed.item.status, "ACTIVE");
  await assert.rejects(() => act(b.id, "complete"), /inspection/);
  assert.equal(await db.ownerPayout.count(), 1);
});
test("luxury successful lifecycle records approval, condition, and large deposit", async () => {
  const b = await toInspection(true);
  const completed = await act(b.id, "pass");
  assert.equal(completed.deposit?.released, 150000);
  assert.ok(completed.history.some((h) => h.newState === "APPROVED"));
  assert.equal(completed.payout?.amount, 43200);
  assert.equal(completed.reports[0].phase, "BEFORE");
});
test("invalid transition rolls back all writes and events", async () => {
  const b = await book();
  const count = await db.platformEvent.count();
  await assert.rejects(() => act(b.id, "pass"), /inspection/);
  assert.equal(await db.conditionReport.count(), 0);
  assert.equal(await db.platformEvent.count(), count);
  assert.equal(
    (await db.booking.findUniqueOrThrow({ where: { id: b.id } })).status,
    "PAYMENT_PENDING",
  );
});
test("role enforcement: unrelated renter cannot approve, cancel, or inject failure", async () => {
  const b = await book(true);
  await assert.rejects(
    () => act(b.id, "approve", {}, "outsider"),
    /participant/,
  );
  await assert.rejects(
    () => act(b.id, "cancel", {}, "outsider"),
    /participants/,
  );
  await act(b.id, "approve");
  await assert.rejects(
    () => act(b.id, "pay", { fail: true }, "sara"),
    /Failure injection/,
  );
});
test("luxury eligibility is rechecked at payment and failed checks roll back", async () => {
  const b = await book(true);
  await act(b.id, "approve");
  await db.user.update({
    where: { id: "sara" },
    data: { identityVerified: false },
  });
  await assert.rejects(() => act(b.id, "pay"), /identity/);
  assert.equal(
    (await db.payment.findUniqueOrThrow({ where: { bookingId: b.id } })).status,
    "PENDING",
  );
});
test("damage freezes deposit; partial deduction releases remainder and settles dispute", async () => {
  const b = await toInspection(true);
  await act(b.id, "damage", { amount: 30000, notes: "Stain on lining" });
  await act(b.id, "dispute", { notes: "It was already present" });
  assert.equal(
    (await db.securityDeposit.findUniqueOrThrow({ where: { bookingId: b.id } }))
      .status,
    "HELD",
  );
  const resolved = await act(b.id, "resolve", {
    amount: 20000,
    decision: "SHARED_RESPONSIBILITY",
  });
  assert.equal(resolved.deposit?.captured, 20000);
  assert.equal(resolved.deposit?.released, 130000);
  assert.equal(resolved.deposit?.status, "PARTIALLY_CAPTURED");
  assert.equal(resolved.claim?.dispute?.status, "RESOLVED");
  const complete = await act(b.id, "complete");
  assert.equal(complete.status, "COMPLETED");
});
test("invalid damage deduction rolls back resolution and holds the deposit", async () => {
  const b = await toInspection();
  await act(b.id, "damage", { amount: 3000 });
  await assert.rejects(
    () => act(b.id, "resolve", { amount: 4000 }),
    /documented claim/,
  );
  const d = await db.securityDeposit.findUniqueOrThrow({
    where: { bookingId: b.id },
  });
  assert.equal(d.status, "HELD");
  assert.equal(d.captured, 0);
});
test("no damage resolution releases the entire deposit", async () => {
  const b = await toInspection();
  await act(b.id, "damage", { amount: 3000 });
  const resolved = await act(b.id, "resolve", {
    decision: "NO_DAMAGE",
    amount: 3000,
  });
  assert.equal(resolved.deposit?.captured, 0);
  assert.equal(resolved.deposit?.released, 10000);
});
test("full damage claim captures the entire deposit", async () => {
  const b = await toInspection();
  await act(b.id, "damage", { amount: 10000 });
  const resolved = await act(b.id, "resolve", { amount: 10000 });
  assert.equal(resolved.deposit?.status, "CAPTURED");
  assert.equal(resolved.deposit?.released, 0);
});
test("late fees update with clock, stop after receipt, and charge only on completion", async () => {
  const b = await book();
  for (const a of ["pay", "prepare", "ship", "deliver", "start"])
    await act(b.id, a);
  await tx((t) => advanceClock(t, "admin", undefined, "2026-10-04T07:00:00Z"));
  let stored = await db.booking.findUniqueOrThrow({
    where: { id: b.id },
    include: bookingInclude,
  });
  assert.equal(stored.overdue, true);
  assert.equal(stored.lateFee, 3500);
  for (const a of ["return", "returnShip", "receive"]) await act(b.id, a);
  await tx((t) => advanceClock(t, "admin", 72));
  stored = await db.booking.findUniqueOrThrow({
    where: { id: b.id },
    include: bookingInclude,
  });
  assert.equal(stored.lateFee, 3500);
  assert.equal(stored.overdue, false);
  await act(b.id, "inspect");
  const completed = await act(b.id, "pass");
  assert.equal(completed.payment?.amount, 15850);
  assert.equal(completed.total, 25850);
  assert.equal(completed.payout?.amount, 11900);
  assert.equal(
    await db.notification.count({
      where: { bookingId: b.id, userId: "sara", type: "RETURN_OVERDUE" },
    }),
    1,
  );
});
test("customer late cancellation receives half refund and full deposit release", async () => {
  const b = await book();
  await act(b.id, "pay");
  const cancelled = await act(b.id, "cancel", {}, "sara");
  assert.equal(cancelled.payment?.refunded, 6175);
  assert.equal(cancelled.payment?.status, "PARTIALLY_REFUNDED");
  assert.equal(cancelled.deposit?.released, 10000);
  assert.equal(cancelled.status, "CANCELLED");
});
test("owner cancellation receives full refund", async () => {
  const b = await book();
  await act(b.id, "pay");
  const cancelled = await act(b.id, "cancel", {}, "daniel");
  assert.equal(cancelled.payment?.status, "REFUNDED");
  assert.equal(cancelled.payment?.refunded, 12350);
});
test("refund and deposit services cannot exceed available balances", async () => {
  const b = await book();
  await act(b.id, "pay");
  await assert.rejects(() => act(b.id, "refund", { amount: 20000 }), /balance/);
  await assert.rejects(
    () => tx((t) => PaymentSimulator.captureDeposit(t, b, 10001, "admin")),
    /held deposit/,
  );
});
test("local pickup uses the same lifecycle and has no delivery fee", async () => {
  const b = await tx((t) =>
    requestBooking(
      t,
      {
        itemId: "item-1",
        renterId: "sara",
        startDate: "2026-10-01",
        endDate: "2026-10-03",
        method: "LOCAL_PICKUP",
      },
      "sara",
    ),
  );
  assert.equal(b.deliveryFee, 0);
  await act(b.id, "pay");
  await act(b.id, "prepare");
  assert.equal((await act(b.id, "ship")).status, "READY_FOR_PICKUP");
  assert.equal((await act(b.id, "deliver")).status, "DELIVERED");
});
test("cannot start before the rental start date", async () => {
  const b = await book(false, "2026-10-03", "2026-10-05");
  for (const a of ["pay", "prepare", "ship", "deliver"]) await act(b.id, a);
  await assert.rejects(() => act(b.id, "start"), /clock/);
  await tx((t) => advanceClock(t, "admin", undefined, "2026-10-03T00:00:00Z"));
  assert.equal((await act(b.id, "start")).status, "RENTAL_ACTIVE");
});
test("scenario reset restores its state without deleting unrelated bookings", async () => {
  const unrelated = await book();
  const id = await tx((t) => resetScenario(t, "normal", "admin"));
  await act(id, "pay");
  const newId = await tx((t) => resetScenario(t, "normal", "admin"));
  assert.notEqual(id, newId);
  assert.equal(
    (await db.booking.findUniqueOrThrow({ where: { id: newId } })).status,
    "PAYMENT_PENDING",
  );
  assert.ok(await db.booking.findUnique({ where: { id: unrelated.id } }));
  assert.equal(await db.platformEvent.count({ where: { entityId: id } }), 0);
});
test("all seven scenario presets initialize with real persisted service state", async () => {
  for (const id of [
    "normal",
    "luxury",
    "payment",
    "rejection",
    "damage",
    "cancel",
    "late",
  ])
    await tx((t) => resetScenario(t, id, "admin"));
  assert.equal(await db.simulatorSession.count(), 7);
  assert.equal(
    (await db.booking.findFirstOrThrow({ where: { scenarioId: "damage" } }))
      .status,
    "DISPUTE",
  );
  assert.equal(
    (await db.booking.findFirstOrThrow({ where: { scenarioId: "late" } }))
      .overdue,
    true,
  );
});
