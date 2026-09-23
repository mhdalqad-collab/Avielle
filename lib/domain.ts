export const states = [
  "BOOKING_REQUESTED",
  "AWAITING_APPROVAL",
  "APPROVED",
  "PAYMENT_PENDING",
  "PAYMENT_FAILED",
  "CONFIRMED",
  "PREPARING",
  "SHIPPED",
  "READY_FOR_PICKUP",
  "DELIVERED",
  "RENTAL_ACTIVE",
  "RETURN_REQUESTED",
  "RETURN_IN_TRANSIT",
  "RETURNED",
  "INSPECTION",
  "ISSUE_REPORTED",
  "DAMAGE_REPORTED",
  "DISPUTE",
  "RESOLVED",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
] as const;
export type BookingStatus = (typeof states)[number];
export const transitions: Record<string, readonly string[]> = {
  BOOKING_REQUESTED: [
    "AWAITING_APPROVAL",
    "PAYMENT_PENDING",
    "REJECTED",
    "CANCELLED",
  ],
  AWAITING_APPROVAL: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["PAYMENT_PENDING", "CANCELLED"],
  PAYMENT_PENDING: ["CONFIRMED", "PAYMENT_FAILED", "CANCELLED"],
  PAYMENT_FAILED: ["PAYMENT_PENDING", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["SHIPPED", "READY_FOR_PICKUP", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  READY_FOR_PICKUP: ["DELIVERED"],
  DELIVERED: ["RENTAL_ACTIVE", "ISSUE_REPORTED", "RETURN_REQUESTED"],
  ISSUE_REPORTED: ["RETURN_REQUESTED"],
  RENTAL_ACTIVE: ["RETURN_REQUESTED"],
  RETURN_REQUESTED: ["RETURN_IN_TRANSIT", "RETURNED"],
  RETURN_IN_TRANSIT: ["RETURNED"],
  RETURNED: ["INSPECTION"],
  INSPECTION: ["COMPLETED", "DAMAGE_REPORTED"],
  DAMAGE_REPORTED: ["DISPUTE", "RESOLVED"],
  DISPUTE: ["RESOLVED"],
  RESOLVED: ["COMPLETED"],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
};
export function assertTransition(from: string, to: string) {
  if (!transitions[from]?.includes(to))
    throw new Error(`Cannot move from ${from} to ${to}.`);
}
export const terminal = ["CANCELLED", "REJECTED", "COMPLETED"];
export const day = 86_400_000;
export const isoDay = (date: string) =>
  new Date(date).toISOString().slice(0, 10);
export function rentalDays(start: string, end: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(end) ||
    !Number.isFinite(Date.parse(start)) ||
    !Number.isFinite(Date.parse(end)) ||
    isoDay(start) !== start ||
    isoDay(end) !== end
  )
    throw new Error("Choose valid rental dates.");
  const n = Math.round((Date.parse(end) - Date.parse(start)) / day) + 1;
  if (n < 1 || n > 60)
    throw new Error("Rentals must be between 1 and 60 calendar days.");
  return n;
}
export function overlaps(a: string, b: string, c: string, d: string) {
  return a <= d && b >= c;
}
export const money = (cents: number) =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);
export const label = (s: string) =>
  s
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./, (c) => c.toUpperCase());
export const PricingService = {
  calculateRentalPrice: (daily: number, days: number) => daily * days,
  calculateServiceFee: (rental: number) => Math.round(rental * 0.1),
  calculateDeliveryFee: (method: string) =>
    method === "LOCAL_PICKUP" ? 0 : method === "PLATFORM_COURIER" ? 1500 : 800,
  calculateDeposit: (amount: number) => amount,
  calculateLateFee: (daily: number, end: string, now: string) =>
    Math.max(
      0,
      Math.floor(
        (Date.parse(now) - (Date.parse(end) + day + 6 * 3600000)) / day,
      ) + 1,
    ) * daily,
  calculateRefund: (
    charged: number,
    actor: string,
    start: string,
    now: string,
  ) =>
    actor !== "RENTER" || Date.parse(start) - Date.parse(now) >= 48 * 3600000
      ? charged
      : Math.round(charged * 0.5),
  calculateOwnerPayout: (rental: number, refund = 0) =>
    Math.max(0, Math.round(rental * 0.8) - refund),
  quote(
    daily: number,
    deposit: number,
    start: string,
    end: string,
    method: string,
    insurance = false,
  ) {
    const days = rentalDays(start, end),
      rental = this.calculateRentalPrice(daily, days),
      serviceFee = this.calculateServiceFee(rental),
      deliveryFee = this.calculateDeliveryFee(method),
      insuranceFee = insurance ? Math.round(rental * 0.05) : 0;
    return {
      days,
      rental,
      serviceFee,
      deliveryFee,
      insuranceFee,
      depositAmount: deposit,
      total: rental + serviceFee + deliveryFee + insuranceFee + deposit,
    };
  },
};
