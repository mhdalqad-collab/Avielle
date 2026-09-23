import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertTransition,
  overlaps,
  PricingService as price,
  rentalDays,
} from "../lib/domain";
test("rental dates are inclusive, validated, and bounded", () => {
  assert.equal(rentalDays("2026-10-01", "2026-10-03"), 3);
  assert.equal(rentalDays("2026-10-01", "2026-10-01"), 1);
  for (const [a, b] of [
    ["2026-10-03", "2026-10-01"],
    ["2026-02-30", "2026-03-01"],
    ["bad", "2026-10-01"],
    ["2026-01-01", "2026-12-31"],
  ])
    assert.throws(() => rentalDays(a, b));
});
test("date conflict includes shared return / start day", () => {
  assert.ok(overlaps("2026-10-01", "2026-10-03", "2026-10-03", "2026-10-05"));
  assert.ok(!overlaps("2026-10-01", "2026-10-03", "2026-10-04", "2026-10-05"));
});
test("quote uses integer cents, inclusive days, service fee, delivery, and deposit", () => {
  assert.deepEqual(
    price.quote(4000, 10000, "2026-10-01", "2026-10-03", "OWNER_SHIPPING"),
    {
      days: 3,
      rental: 12000,
      serviceFee: 1200,
      deliveryFee: 800,
      insuranceFee: 0,
      depositAmount: 10000,
      total: 24000,
    },
  );
  assert.equal(
    price.quote(3333, 10000, "2026-10-01", "2026-10-01", "LOCAL_PICKUP", true)
      .total,
    13833,
  );
});
test("invalid state jumps and duplicate completion are rejected", () => {
  assert.doesNotThrow(() => assertTransition("SHIPPED", "DELIVERED"));
  assert.throws(() => assertTransition("BOOKING_REQUESTED", "COMPLETED"));
  assert.throws(() => assertTransition("COMPLETED", "COMPLETED"));
});
test("six-hour return grace period and daily late fee", () => {
  assert.equal(
    price.calculateLateFee(3500, "2026-10-03", "2026-10-04T05:59:59Z"),
    0,
  );
  assert.equal(
    price.calculateLateFee(3500, "2026-10-03", "2026-10-04T06:00:00Z"),
    3500,
  );
  assert.equal(
    price.calculateLateFee(3500, "2026-10-03", "2026-10-05T06:00:00Z"),
    7000,
  );
});
test("renter refund cutoff is 48 hours; owner and platform refunds are full", () => {
  assert.equal(
    price.calculateRefund(
      14000,
      "RENTER",
      "2026-10-05",
      "2026-10-03T00:00:00Z",
    ),
    14000,
  );
  assert.equal(
    price.calculateRefund(
      14000,
      "RENTER",
      "2026-10-05",
      "2026-10-04T00:00:00Z",
    ),
    7000,
  );
  assert.equal(
    price.calculateRefund(14000, "OWNER", "2026-10-05", "2026-10-04T00:00:00Z"),
    14000,
  );
  assert.equal(
    price.calculateRefund(
      14000,
      "PLATFORM",
      "2026-10-05",
      "2026-10-04T00:00:00Z",
    ),
    14000,
  );
});
test("owner payout deducts 20% commission and applicable refunds, never below zero", () => {
  assert.equal(price.calculateOwnerPayout(12000), 9600);
  assert.equal(price.calculateOwnerPayout(12000, 2000), 7600);
  assert.equal(price.calculateOwnerPayout(12000, 14000), 0);
});
