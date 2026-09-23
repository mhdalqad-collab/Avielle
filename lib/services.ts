import { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import {
  assertTransition,
  day,
  isoDay,
  label,
  PricingService,
  rentalDays,
  terminal,
} from "./domain";

type Tx = Prisma.TransactionClient;
export const bookingInclude = {
  item: { include: { owner: true } },
  renter: true,
  payment: true,
  deposit: true,
  payout: true,
  delivery: { include: { events: { orderBy: { simulatedAt: "asc" } } } },
  reports: { orderBy: { phase: "desc" } },
  claim: { include: { dispute: true } },
  messages: { orderBy: { createdAt: "asc" } },
  reviews: true,
  history: true,
} satisfies Prisma.BookingInclude;
export type FullBooking = Prisma.BookingGetPayload<{
  include: typeof bookingInclude;
}>;
export async function now(tx: Tx) {
  return (await tx.platformClock.findUniqueOrThrow({ where: { id: "clock" } }))
    .now;
}
async function user(tx: Tx, id: string) {
  const u = await tx.user.findUniqueOrThrow({ where: { id } });
  if (!u.active) throw new Error("This account is suspended.");
  return u;
}
export async function requireAdmin(tx: Tx, id: string) {
  const u = await user(tx, id);
  if (u.role !== "ADMIN")
    throw new Error("Switch to Admin to perform this action.");
  return u;
}
export async function emit(
  tx: Tx,
  type: string,
  entityId: string,
  actor: string,
  metadata: Record<string, unknown> = {},
  oldState = "",
  newState = "",
  entityType = "Booking",
) {
  const simulatedAt = await now(tx);
  await tx.platformEvent.create({
    data: {
      type,
      entityType,
      entityId,
      actor,
      metadata: JSON.stringify(metadata),
      oldState,
      newState,
      simulatedAt,
    },
  });
  if (entityType === "Booking") {
    const b = await tx.booking.findUnique({
      where: { id: entityId },
      include: { item: true },
    });
    if (b)
      await tx.notification.createMany({
        data: [b.renterId, b.item.ownerId].map((userId) => ({
          userId,
          bookingId: entityId,
          type,
          text: `${label(type)} · ${b.item.title}`,
          simulatedAt,
        })),
      });
  }
}
async function move(
  tx: Tx,
  b: FullBooking,
  to: string,
  actor: string,
  event: string,
) {
  assertTransition(b.status, to);
  await tx.booking.update({ where: { id: b.id }, data: { status: to } });
  await tx.bookingStatusHistory.create({
    data: {
      bookingId: b.id,
      oldState: b.status,
      newState: to,
      actor,
      simulatedAt: await now(tx),
    },
  });
  await emit(tx, event, b.id, actor, {}, b.status, to);
  b.status = to;
}
function eligibility(item: FullBooking["item"], renter: FullBooking["renter"]) {
  if (!renter.active || !item.owner.active)
    throw new Error("Both marketplace accounts must be active.");
  if (item.tier === "LUXURY") {
    if (!item.owner.verified)
      throw new Error("Luxury owner verification is required.");
    if (item.authenticationStatus !== "VERIFIED")
      throw new Error("Item authentication is required.");
    if (item.identityVerificationRequired && !renter.identityVerified)
      throw new Error(
        "Verify the renter’s identity before booking this luxury item.",
      );
    if (renter.rating < item.minimumRenterRating)
      throw new Error(
        `A renter rating of ${item.minimumRenterRating} is required.`,
      );
  }
}
export const requestSchema = z.object({
  itemId: z.string(),
  renterId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  method: z.enum(["OWNER_SHIPPING", "PLATFORM_COURIER", "LOCAL_PICKUP"]),
  insurance: z.boolean().default(false),
  scenarioId: z.string().optional(),
});
export async function requestBooking(
  tx: Tx,
  input: z.input<typeof requestSchema>,
  actor: string,
) {
  const p = requestSchema.parse(input),
    acting = await user(tx, actor),
    renter = await user(tx, p.renterId);
  if (actor !== p.renterId && acting.role !== "ADMIN")
    throw new Error("You can only book for your own account.");
  const item = await tx.item.findUniqueOrThrow({
    where: { id: p.itemId },
    include: { owner: true },
  });
  if (item.ownerId === p.renterId)
    throw new Error("You cannot rent your own item.");
  if (
    ["DRAFT", "PENDING_APPROVAL", "MAINTENANCE", "SUSPENDED"].includes(
      item.status,
    )
  )
    throw new Error("This listing is not available for booking.");
  if (!item.deliveryOptions.split(",").includes(p.method))
    throw new Error("Choose an offered delivery method.");
  if (
    p.startDate < isoDay(await now(tx)) ||
    p.startDate < item.availableFrom ||
    p.endDate > item.availableTo
  )
    throw new Error(
      "Choose dates within the item’s availability and after the platform date.",
    );
  eligibility(item, renter);
  if (item.insuranceRequired && !p.insurance)
    throw new Error("This item requires simulated insurance.");
  const quote = PricingService.quote(
    item.rentalPricePerDay,
    item.securityDeposit,
    p.startDate,
    p.endDate,
    p.method,
    p.insurance,
  );
  const conflict = await tx.booking.findFirst({
    where: {
      itemId: item.id,
      status: { notIn: terminal },
      startDate: { lte: p.endDate },
      endDate: { gte: p.startDate },
    },
  });
  if (conflict)
    throw new Error(
      "These dates overlap another booking. Please choose different dates.",
    );
  const b = await tx.booking.create({
    data: {
      itemId: item.id,
      renterId: renter.id,
      startDate: p.startDate,
      endDate: p.endDate,
      ...quote,
      scenarioId: p.scenarioId,
      payment: { create: { amount: quote.total - quote.depositAmount } },
      deposit: {
        create: {
          amount: quote.depositAmount,
          status: quote.depositAmount ? "PENDING" : "NOT_REQUIRED",
        },
      },
      delivery: {
        create: {
          method: p.method,
          tracking: `AVIELLE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        },
      },
    },
    include: bookingInclude,
  });
  await emit(tx, "BOOKING_CREATED", b.id, actor, { ...quote });
  await move(
    tx,
    b,
    item.approvalRequired ? "AWAITING_APPROVAL" : "PAYMENT_PENDING",
    actor,
    item.approvalRequired ? "APPROVAL_REQUESTED" : "PAYMENT_REQUESTED",
  );
  return b;
}
export const PaymentSimulator = {
  async authorizePayment(tx: Tx, b: FullBooking, actor: string) {
    await tx.payment.update({
      where: { bookingId: b.id },
      data: { status: "AUTHORIZED" },
    });
    await emit(tx, "PAYMENT_AUTHORIZED", b.id, actor);
  },
  async capturePayment(tx: Tx, b: FullBooking, actor: string) {
    await tx.payment.update({
      where: { bookingId: b.id },
      data: { status: "CAPTURED" },
    });
    await emit(tx, "PAYMENT_CAPTURED", b.id, actor);
  },
  async authorizeDeposit(tx: Tx, b: FullBooking, actor: string) {
    await tx.securityDeposit.update({
      where: { bookingId: b.id },
      data: { status: b.depositAmount ? "HELD" : "NOT_REQUIRED" },
    });
    await emit(tx, "DEPOSIT_AUTHORIZED", b.id, actor, {
      amount: b.depositAmount,
    });
  },
  async releaseDeposit(tx: Tx, b: FullBooking, actor: string) {
    const d = await tx.securityDeposit.findUniqueOrThrow({
      where: { bookingId: b.id },
    });
    const released =
      d.status === "PENDING" || d.status === "NOT_REQUIRED"
        ? 0
        : d.amount - d.captured;
    await tx.securityDeposit.update({
      where: { bookingId: b.id },
      data: {
        released,
        status: d.captured
          ? d.captured === d.amount
            ? "CAPTURED"
            : "PARTIALLY_CAPTURED"
          : d.amount
            ? "RELEASED"
            : "NOT_REQUIRED",
      },
    });
    await emit(tx, "DEPOSIT_RELEASED", b.id, actor, {
      released,
      authorizationCancelled: d.status === "PENDING",
    });
  },
  async captureDeposit(tx: Tx, b: FullBooking, amount: number, actor: string) {
    const d = await tx.securityDeposit.findUniqueOrThrow({
      where: { bookingId: b.id },
    });
    if (d.status !== "HELD" || amount < 0 || amount > d.amount)
      throw new Error("Deduction must be within the held deposit.");
    await tx.securityDeposit.update({
      where: { bookingId: b.id },
      data: { captured: amount },
    });
    await emit(tx, "DEPOSIT_CAPTURED", b.id, actor, { amount });
  },
  async refundPayment(tx: Tx, b: FullBooking, amount: number, actor: string) {
    const p = await tx.payment.findUniqueOrThrow({
      where: { bookingId: b.id },
    });
    if (
      amount < 0 ||
      amount > p.amount - p.refunded ||
      !["CAPTURED", "PARTIALLY_REFUNDED"].includes(p.status)
    )
      throw new Error("Refund exceeds the captured payment balance.");
    await tx.payment.update({
      where: { bookingId: b.id },
      data: {
        refunded: p.refunded + amount,
        status:
          p.refunded + amount === p.amount ? "REFUNDED" : "PARTIALLY_REFUNDED",
      },
    });
    await emit(tx, "PAYMENT_REFUNDED", b.id, actor, { amount });
  },
  async sendOwnerPayout(tx: Tx, b: FullBooking, actor: string) {
    const p = await tx.payment.findUniqueOrThrow({
      where: { bookingId: b.id },
    });
    const amount =
      PricingService.calculateOwnerPayout(b.rental, p.refunded) + b.lateFee;
    await tx.ownerPayout.create({ data: { bookingId: b.id, amount } });
    await emit(tx, "OWNER_PAYOUT_COMPLETED", b.id, actor, { amount });
  },
};
const actionRoles: Record<string, string> = {
  approve: "owner",
  reject: "owner",
  pay: "renter",
  prepare: "owner",
  ship: "owner",
  deliver: "renter",
  start: "renter",
  return: "renter",
  returnShip: "renter",
  receive: "owner",
  inspect: "owner",
  pass: "owner",
  damage: "owner",
  dispute: "renter",
  resolve: "admin",
  complete: "owner",
  issue: "renter",
  refund: "admin",
};
export type ActionOptions = {
  fail?: boolean;
  failure?: string;
  notes?: string;
  photos?: string;
  amount?: number;
  decision?: string;
  cancelBy?: string;
};
export async function bookingAction(
  tx: Tx,
  id: string,
  action: string,
  actor: string,
  options: ActionOptions = {},
) {
  if (
    options.amount !== undefined &&
    (!Number.isSafeInteger(options.amount) || options.amount < 0)
  )
    throw new Error("Use a non-negative amount in integer cents.");
  if (options.photos !== undefined)
    z.array(
      z
        .string()
        .refine(
          (url) =>
            url.startsWith("/uploads/") ||
            url.startsWith("/images/") ||
            url.startsWith("https://"),
        ),
    )
      .min(1)
      .max(8)
      .parse(JSON.parse(options.photos));
  const b = await tx.booking.findUniqueOrThrow({
      where: { id },
      include: bookingInclude,
    }),
    u = await user(tx, actor),
    role = actionRoles[action];
  if (
    u.role !== "ADMIN" &&
    ((role === "owner" && b.item.ownerId !== actor) ||
      (role === "renter" && b.renterId !== actor) ||
      role === "admin" ||
      (!role && action !== "cancel"))
  )
    throw new Error(
      "Switch to the appropriate booking participant to perform this action.",
    );
  if (u.role !== "ADMIN" && (options.fail || options.failure))
    throw new Error(
      "Failure injection is available to Admin in the simulator.",
    );
  const clock = await now(tx);
  const delivery = async (status: string) => {
    await tx.delivery.update({
      where: { bookingId: id },
      data: { status, events: { create: { status, simulatedAt: clock } } },
    });
  };
  const report = async (phase: string, condition: string) =>
    tx.conditionReport.upsert({
      where: { bookingId_phase: { bookingId: id, phase } },
      create: {
        bookingId: id,
        phase,
        condition,
        notes: options.notes || condition,
        photos: options.photos || b.item.images,
        createdBy: actor,
        simulatedAt: clock,
      },
      update: {
        condition,
        notes: options.notes || condition,
        photos: options.photos || b.item.images,
        createdBy: actor,
        simulatedAt: clock,
      },
    });
  switch (action) {
    case "approve":
      await move(tx, b, "APPROVED", actor, "BOOKING_APPROVED");
      await move(tx, b, "PAYMENT_PENDING", actor, "PAYMENT_REQUESTED");
      break;
    case "reject":
      await move(tx, b, "REJECTED", actor, "BOOKING_REJECTED");
      await PaymentSimulator.releaseDeposit(tx, b, actor);
      await refreshItem(tx, b.itemId);
      break;
    case "pay": {
      if (b.status === "PAYMENT_FAILED")
        await move(tx, b, "PAYMENT_PENDING", actor, "PAYMENT_RETRIED");
      assertTransition(b.status, "CONFIRMED");
      if (b.endDate < isoDay(clock))
        throw new Error(
          "These rental dates have passed. Cancel this booking and choose new dates, or reset the simulator scenario.",
        );
      if (
        ["SUSPENDED", "MAINTENANCE", "PENDING_APPROVAL"].includes(b.item.status)
      )
        throw new Error(
          "This listing is currently unavailable. Contact the owner or cancel the booking.",
        );
      eligibility(b.item, b.renter);
      if (options.fail || options.failure === "DEPOSIT") {
        await tx.payment.update({
          where: { bookingId: id },
          data: { status: "FAILED" },
        });
        await move(
          tx,
          b,
          "PAYMENT_FAILED",
          actor,
          options.failure === "DEPOSIT"
            ? "DEPOSIT_AUTHORIZATION_FAILED"
            : "PAYMENT_FAILED",
        );
        break;
      }
      await PaymentSimulator.authorizePayment(tx, b, actor);
      await PaymentSimulator.authorizeDeposit(tx, b, actor);
      await PaymentSimulator.capturePayment(tx, b, actor);
      await move(tx, b, "CONFIRMED", actor, "BOOKING_CONFIRMED");
      break;
    }
    case "prepare":
      await move(tx, b, "PREPARING", actor, "ITEM_PREPARED");
      await report("BEFORE", b.item.condition);
      await delivery("LABEL_CREATED");
      break;
    case "ship":
      await move(
        tx,
        b,
        b.delivery?.method === "LOCAL_PICKUP" ? "READY_FOR_PICKUP" : "SHIPPED",
        actor,
        b.delivery?.method === "LOCAL_PICKUP"
          ? "READY_FOR_PICKUP"
          : "ITEM_SHIPPED",
      );
      await delivery(
        b.delivery?.method === "LOCAL_PICKUP"
          ? "READY_FOR_PICKUP"
          : "IN_TRANSIT",
      );
      break;
    case "delay": {
      if (
        u.role !== "ADMIN" ||
        !["SHIPPED", "READY_FOR_PICKUP"].includes(b.status)
      )
        throw new Error("A dispatched booking is required.");
      const delayedUntil = new Date(Date.parse(clock) + day).toISOString();
      await tx.delivery.update({
        where: { bookingId: id },
        data: { delayedUntil },
      });
      await delivery("DELAYED");
      await emit(tx, "DELIVERY_DELAYED", id, actor, {
        hours: 24,
        delayedUntil,
      });
      break;
    }
    case "deliver":
      if (
        b.delivery?.delayedUntil &&
        Date.parse(clock) < Date.parse(b.delivery.delayedUntil)
      )
        throw new Error(
          `Delivery delayed until ${b.delivery.delayedUntil}. Advance the platform clock to continue.`,
        );
      await move(tx, b, "DELIVERED", actor, "ITEM_DELIVERED");
      await delivery("OUT_FOR_DELIVERY");
      await delivery("DELIVERED");
      break;
    case "start":
      if (isoDay(clock) < b.startDate)
        throw new Error("Advance the platform clock to the rental start date.");
      await move(tx, b, "RENTAL_ACTIVE", actor, "RENTAL_STARTED");
      break;
    case "issue":
      await move(tx, b, "ISSUE_REPORTED", actor, "ISSUE_REPORTED");
      await emit(tx, "RECEIPT_PROBLEM", id, actor, {
        notes: options.notes || "Item does not match its condition report.",
      });
      break;
    case "return":
      await move(tx, b, "RETURN_REQUESTED", actor, "RETURN_REQUESTED");
      break;
    case "returnShip":
      await move(tx, b, "RETURN_IN_TRANSIT", actor, "RETURN_SHIPPED");
      await delivery("RETURN_IN_TRANSIT");
      break;
    case "receive":
      await move(tx, b, "RETURNED", actor, "ITEM_RETURNED");
      await delivery("RETURNED");
      await tx.booking.update({ where: { id }, data: { overdue: false } });
      break;
    case "inspect":
      await move(tx, b, "INSPECTION", actor, "INSPECTION_STARTED");
      break;
    case "pass":
      await report("AFTER", b.item.condition);
      await finish(tx, b, actor);
      break;
    case "damage": {
      await move(tx, b, "DAMAGE_REPORTED", actor, "DAMAGE_REPORTED");
      const amount = options.amount ?? Math.round(b.depositAmount * 0.2);
      if (amount < 0 || amount > b.depositAmount)
        throw new Error("Claim amount must be within the deposit.");
      await report("AFTER", "Damage found");
      await tx.damageClaim.create({
        data: {
          bookingId: id,
          description:
            options.notes ||
            "Small stain on the lining, documented after return.",
          amount,
        },
      });
      break;
    }
    case "dispute":
      await move(tx, b, "DISPUTE", actor, "DISPUTE_OPENED");
      if (!b.claim) throw new Error("A damage claim is required.");
      await tx.dispute.create({
        data: {
          claimId: b.claim.id,
          reason: options.notes || "Renter contests the damage assessment.",
        },
      });
      break;
    case "resolve": {
      assertTransition(b.status, "RESOLVED");
      if (!b.claim) throw new Error("No claim to resolve.");
      const decision = z
        .enum([
          "NO_DAMAGE",
          "RENTER_RESPONSIBLE",
          "OWNER_RESPONSIBLE",
          "SHARED_RESPONSIBILITY",
        ])
        .parse(options.decision || "RENTER_RESPONSIBLE");
      const amount = ["NO_DAMAGE", "OWNER_RESPONSIBLE"].includes(decision)
        ? 0
        : (options.amount ??
          Math.round(
            b.claim.amount * (decision === "SHARED_RESPONSIBILITY" ? 0.5 : 1),
          ));
      if (amount > b.claim.amount)
        throw new Error("Deduction cannot exceed the documented claim.");
      await PaymentSimulator.captureDeposit(tx, b, amount, actor);
      await PaymentSimulator.releaseDeposit(tx, b, actor);
      await tx.damageClaim.update({
        where: { bookingId: id },
        data: { status: "RESOLVED", decision, deduction: amount },
      });
      if (b.claim.dispute)
        await tx.dispute.update({
          where: { claimId: b.claim.id },
          data: { status: "RESOLVED", resolution: decision },
        });
      await move(tx, b, "RESOLVED", actor, "DISPUTE_RESOLVED");
      break;
    }
    case "complete":
      await finish(tx, b, actor);
      break;
    case "refund":
      if (b.payout) throw new Error("Refund before the owner payout is sent.");
      await PaymentSimulator.refundPayment(tx, b, options.amount ?? 0, actor);
      break;
    case "cancel": {
      const cancelBy =
        u.role === "ADMIN"
          ? options.cancelBy || "PLATFORM"
          : actor === b.renterId
            ? "RENTER"
            : actor === b.item.ownerId
              ? "OWNER"
              : null;
      if (!cancelBy) throw new Error("Only booking participants can cancel.");
      await move(tx, b, "CANCELLED", actor, "BOOKING_CANCELLED");
      if (
        b.payment &&
        ["CAPTURED", "PARTIALLY_REFUNDED"].includes(b.payment.status)
      )
        await PaymentSimulator.refundPayment(
          tx,
          b,
          PricingService.calculateRefund(
            b.payment.amount - b.payment.refunded,
            cancelBy,
            b.startDate,
            clock,
          ),
          actor,
        );
      await PaymentSimulator.releaseDeposit(tx, b, actor);
      await refreshItem(tx, b.itemId);
      break;
    }
    default:
      throw new Error("Unknown booking action.");
  }
  await refreshItem(tx, b.itemId);
  return tx.booking.findUniqueOrThrow({
    where: { id },
    include: bookingInclude,
  });
}
async function refreshItem(tx: Tx, itemId: string) {
  const item = await tx.item.findUniqueOrThrow({ where: { id: itemId } });
  // Workflow completion must never undo an administrative pause or maintenance hold.
  if (["SUSPENDED", "MAINTENANCE", "PENDING_APPROVAL"].includes(item.status))
    return;
  const bookings = await tx.booking.findMany({
    where: { itemId, status: { notIn: terminal } },
    select: { status: true },
  });
  const stages = bookings.map((booking) => booking.status);
  const status = stages.some((s) =>
    [
      "RETURNED",
      "INSPECTION",
      "DAMAGE_REPORTED",
      "DISPUTE",
      "RESOLVED",
    ].includes(s),
  )
    ? "INSPECTION"
    : stages.some((s) => ["RETURN_REQUESTED", "RETURN_IN_TRANSIT"].includes(s))
      ? "RETURNING"
      : stages.some((s) =>
            ["DELIVERED", "RENTAL_ACTIVE", "ISSUE_REPORTED"].includes(s),
          )
        ? "RENTED"
        : stages.some((s) =>
              [
                "CONFIRMED",
                "PREPARING",
                "SHIPPED",
                "READY_FOR_PICKUP",
              ].includes(s),
            )
          ? "RESERVED"
          : "ACTIVE";
  await tx.item.update({
    where: { id: itemId },
    data: { status },
  });
}
async function finish(tx: Tx, b: FullBooking, actor: string) {
  if (!["INSPECTION", "RESOLVED"].includes(b.status))
    throw new Error("Complete the return inspection first.");
  if (b.status === "INSPECTION")
    await PaymentSimulator.releaseDeposit(tx, b, actor);
  if (b.lateFee) {
    await tx.payment.update({
      where: { bookingId: b.id },
      data: { amount: { increment: b.lateFee } },
    });
    await tx.booking.update({
      where: { id: b.id },
      data: { total: { increment: b.lateFee } },
    });
    await emit(tx, "LATE_FEE_CAPTURED", b.id, actor, { amount: b.lateFee });
  }
  await PaymentSimulator.sendOwnerPayout(tx, b, actor);
  await move(tx, b, "COMPLETED", actor, "BOOKING_COMPLETED");
  await refreshItem(tx, b.itemId);
}
export async function advanceClock(
  tx: Tx,
  actor: string,
  hours?: number,
  target?: string,
) {
  await requireAdmin(tx, actor);
  if (target && !Number.isFinite(Date.parse(target)))
    throw new Error("Choose a valid platform time.");
  const previous = await now(tx),
    next =
      target ||
      new Date(Date.parse(previous) + (hours ?? 24) * 3600000).toISOString();
  if (Date.parse(next) < Date.parse(previous))
    throw new Error(
      "The clock cannot move backwards. Reset a scenario to use fresh dates.",
    );
  await tx.platformClock.update({
    where: { id: "clock" },
    data: { now: next },
  });
  await emit(
    tx,
    "CLOCK_ADVANCED",
    "clock",
    actor,
    { previous, next },
    "",
    "",
    "System",
  );
  const bookings = await tx.booking.findMany({
    where: { status: { notIn: terminal } },
    include: bookingInclude,
  });
  for (const b of bookings) {
    const notifyOnce = async (type: string) => {
      if (
        !(await tx.notification.findFirst({ where: { bookingId: b.id, type } }))
      )
        await emit(tx, type, b.id, "system");
    };
    if (
      isoDay(next) >=
        isoDay(new Date(Date.parse(b.startDate) - day).toISOString()) &&
      isoDay(next) < b.startDate
    )
      await notifyOnce("RENTAL_STARTS_TOMORROW");
    if (
      [
        "DELIVERED",
        "RENTAL_ACTIVE",
        "RETURN_REQUESTED",
        "RETURN_IN_TRANSIT",
        "ISSUE_REPORTED",
      ].includes(b.status)
    ) {
      if (
        isoDay(next) ===
        isoDay(new Date(Date.parse(b.endDate) - day).toISOString())
      )
        await notifyOnce("RETURN_DUE_TOMORROW");
      if (
        isoDay(next) >= b.endDate &&
        Date.parse(next) < Date.parse(b.endDate) + day
      )
        await notifyOnce("RETURN_DUE_TODAY");
      if (Date.parse(next) >= Date.parse(b.endDate) + day) {
        const lateFee = PricingService.calculateLateFee(
          b.item.rentalPricePerDay,
          b.endDate,
          next,
        );
        await tx.booking.update({
          where: { id: b.id },
          data: { overdue: true, lateFee },
        });
        await notifyOnce("RETURN_OVERDUE");
        if (lateFee > b.lateFee)
          await emit(tx, "LATE_FEE_ADDED", b.id, "system", { amount: lateFee });
      }
    }
  }
  return next;
}
export const listingSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(10).max(2000),
  brand: z.string().min(1),
  category: z.enum([
    "Suits",
    "Dresses",
    "Bags",
    "Jackets",
    "Shoes",
    "Accessories",
    "Coats",
    "Evening Wear",
  ]),
  tier: z.enum(["NORMAL", "LUXURY"]),
  size: z.string().min(1),
  gender: z.string().default("Unisex"),
  color: z.string().min(1),
  condition: z.string().min(1),
  replacementValue: z.number().int().positive(),
  rentalPricePerDay: z.number().int().positive(),
  securityDeposit: z.number().int().nonnegative(),
  location: z.string().min(1),
  deliveryOptions: z.string().min(1),
  approvalRequired: z.boolean(),
  availableFrom: z.string(),
  availableTo: z.string(),
  images: z.string(),
  designer: z.string().default(""),
  collection: z.string().default(""),
  year: z.number().int().min(1900).max(2030).default(2025),
  serialNumber: z.string().default(""),
  proofOfPurchase: z.string().default("Demo purchase record"),
  certificate: z.string().default(""),
  insuranceRequired: z.boolean().default(false),
  minimumRenterRating: z.number().min(0).max(5).default(0),
  identityVerificationRequired: z.boolean().default(false),
});
export async function createListing(tx: Tx, actor: string, data: unknown) {
  const owner = await user(tx, actor);
  if (!["OWNER", "INFLUENCER", "ADMIN"].includes(owner.role))
    throw new Error("Switch to an owner account to list an item.");
  const p = listingSchema.parse(data);
  rentalDays(p.availableFrom, p.availableFrom);
  rentalDays(p.availableTo, p.availableTo);
  if (p.availableFrom > p.availableTo)
    throw new Error("Availability end must be after the start.");
  const imgs = z
    .array(
      z
        .string()
        .refine(
          (s) =>
            s.startsWith("https://") ||
            s.startsWith("/uploads/") ||
            s.startsWith("/images/"),
          "Use an uploaded image or an HTTPS URL.",
        ),
    )
    .min(1)
    .max(8)
    .parse(JSON.parse(p.images));
  if (
    p.deliveryOptions
      .split(",")
      .some(
        (m) =>
          !["OWNER_SHIPPING", "PLATFORM_COURIER", "LOCAL_PICKUP"].includes(m),
      )
  )
    throw new Error("Invalid delivery option.");
  const item = await tx.item.create({
    data: {
      ...p,
      images: JSON.stringify(imgs),
      ownerId: actor,
      status: p.tier === "LUXURY" ? "PENDING_APPROVAL" : "ACTIVE",
      authenticationStatus: p.tier === "LUXURY" ? "PENDING" : "NOT_REQUIRED",
      identityVerificationRequired: p.tier === "LUXURY",
      minimumRenterRating:
        p.tier === "LUXURY" ? Math.max(4, p.minimumRenterRating) : 0,
    },
  });
  await emit(tx, "LISTING_CREATED", item.id, actor, {}, "", "", "Item");
  return item;
}
export async function runTransaction<T>(
  fn: (tx: Tx) => Promise<T>,
  client: PrismaClient = db,
) {
  return client.$transaction(fn, { maxWait: 30000, timeout: 120000 });
}
