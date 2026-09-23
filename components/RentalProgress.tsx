import { Check } from "lucide-react";
import type { FullBooking } from "@/lib/services";

export function RentalProgress({ booking }: { booking: FullBooking }) {
  const steps = [
    {
      label: "Requested",
      states: ["BOOKING_REQUESTED", "AWAITING_APPROVAL", "PAYMENT_PENDING"],
    },
    ...(booking.item.approvalRequired
      ? [{ label: "Approved", states: ["APPROVED"] }]
      : []),
    { label: "Payment", states: ["CONFIRMED"] },
    { label: "Prepared", states: ["PREPARING"] },
    { label: "Dispatched", states: ["SHIPPED", "READY_FOR_PICKUP"] },
    { label: "Delivered", states: ["DELIVERED"] },
    { label: "Wearing", states: ["RENTAL_ACTIVE"] },
    {
      label: "Return",
      states: ["RETURN_REQUESTED", "RETURN_IN_TRANSIT", "RETURNED"],
    },
    {
      label: "Inspection",
      states: ["INSPECTION", "DAMAGE_REPORTED", "DISPUTE", "RESOLVED"],
    },
    { label: "Complete", states: ["COMPLETED"] },
  ];
  const visited = new Set(booking.history.map((entry) => entry.newState));
  const current = steps.reduce(
    (last, step, index) =>
      step.states.some((s) => visited.has(s)) ? index : last,
    0,
  );
  const closed = ["CANCELLED", "REJECTED"].includes(booking.status);
  return (
    <ol className="rental-progress" aria-label="Rental progress">
      {steps.map((step, index) => (
        <li
          key={step.label}
          className={
            index < current || booking.status === "COMPLETED"
              ? "done"
              : index === current && !closed
                ? "current"
                : ""
          }
          aria-current={index === current && !closed ? "step" : undefined}
        >
          <span>
            {index < current || booking.status === "COMPLETED" ? (
              <Check size={13} />
            ) : (
              index + 1
            )}
          </span>
          <strong>{step.label}</strong>
        </li>
      ))}
    </ol>
  );
}
