export const scenarios = [
  {
    id: "normal",
    name: "Successful everyday rental",
    description:
      "From a three-day booking to inspection, deposit release, and owner payout.",
    itemId: "item-1",
  },
  {
    id: "luxury",
    name: "Successful luxury rental",
    description:
      "Identity, authenticity, approval, insurance, and a protected deposit.",
    itemId: "item-23",
  },
  {
    id: "payment",
    name: "Payment failure & retry",
    description: "Inject a failed authorization, then retry the same booking.",
    itemId: "item-2",
  },
  {
    id: "rejection",
    name: "Owner rejects a booking",
    description: "Decline a luxury request and release the dates and deposit.",
    itemId: "item-24",
  },
  {
    id: "damage",
    name: "Damage claim & dispute",
    description:
      "Compare condition reports, review evidence, and settle a deposit deduction.",
    itemId: "item-25",
  },
  {
    id: "late",
    name: "Late return",
    description:
      "Advance past the deadline and grace period to calculate a daily late fee.",
    itemId: "item-3",
  },
  {
    id: "cancel",
    name: "Cancellation & refunds",
    description: "Compare renter, owner, and platform cancellation outcomes.",
    itemId: "item-4",
  },
] as const;
