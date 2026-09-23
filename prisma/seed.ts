import { db } from "../lib/db";
import {
  runTransaction,
  requestBooking,
  bookingAction,
  advanceClock,
} from "../lib/services";
import { resetScenario } from "../lib/simulator";
const images = {
  suit: "/images/suit.jpg",
  bag: "/images/bag.jpg",
  dress: "/images/dress.jpg",
  coat: "/images/coat.jpg",
  shoes: "/images/shoes.jpg",
  evening: "/images/evening.jpg",
  hero: "/images/hero.jpg",
};
async function main() {
  if (await db.user.count()) {
    console.log("Seed data already exists. Database preserved.");
    return;
  }
  await runTransaction(async (tx) => {
    await tx.platformClock.create({
      data: { id: "clock", now: "2026-09-28T10:00:00.000Z" },
    });
    const users = [
      {
        id: "sara",
        name: "Sara Müller",
        role: "RENTER",
        bio: "Finding something special for every occasion.",
      },
      {
        id: "daniel",
        name: "Daniel Weber",
        role: "OWNER",
        bio: "Considered essentials, shared with care.",
      },
      {
        id: "lina",
        name: "Lina Laurent",
        role: "INFLUENCER",
        bio: "A little Paris, a little Berlin. Pieces from my personal wardrobe.",
        followers: 128400,
        username: "@linalaurent",
      },
      {
        id: "maya",
        name: "Maya Chen",
        role: "INFLUENCER",
        bio: "Modern silhouettes. Vintage treasures. Always rewear.",
        followers: 86400,
        username: "@mayawears",
      },
      {
        id: "noah",
        name: "Noah Rossi",
        role: "INFLUENCER",
        bio: "Tailoring, texture, and a different way to dress.",
        followers: 64200,
        username: "@noahrossi",
      },
      {
        id: "admin",
        name: "Admin",
        role: "ADMIN",
        bio: "Marketplace operations",
      },
      { id: "amelia", name: "Amelia Fischer", role: "OWNER" },
      { id: "leo", name: "Leo Martin", role: "OWNER" },
      { id: "sofia", name: "Sofia Becker", role: "RENTER" },
      { id: "oliver", name: "Oliver Braun", role: "RENTER" },
      { id: "ella", name: "Ella Winter", role: "RENTER" },
      { id: "lucas", name: "Lucas Klein", role: "RENTER" },
    ];
    for (const u of users)
      await tx.user.create({
        data: {
          ...u,
          avatar: "",
          verified: u.role !== "RENTER",
          identityVerified: true,
          rating: u.id === "sara" ? 4.9 : 4.8,
        },
      });
    const normals: [string, string, string, string, number][] = [
      ["Navy Business Suit", "COS", "Suits", "suit", 35],
      ["The Occasion Dress", "& Other Stories", "Dresses", "dress", 24],
      ["Everyday Leather Tote", "Arket", "Bags", "bag", 18],
      ["The Classic Trench", "COS", "Coats", "coat", 28],
      ["Evening Heels", "Aeyde", "Shoes", "shoes", 22],
      ["Scarlet Evening Dress", "Reformation", "Evening Wear", "evening", 42],
      ["Relaxed Wool Blazer", "Arket", "Jackets", "suit", 20],
      ["Weekend Crossbody", "Sézane", "Bags", "bag", 16],
      ["Silk Slip Dress", "Massimo Dutti", "Dresses", "evening", 25],
      ["City Wool Coat", "Weekday", "Coats", "coat", 26],
      ["Tailored Two-Piece", "Mango", "Suits", "suit", 30],
      ["Dinner Party Dress", "Ganni", "Dresses", "dress", 32],
      ["Minimal Shoulder Bag", "COS", "Bags", "bag", 19],
      ["Sculptural Heels", "Arket", "Shoes", "shoes", 21],
      ["Oversized Blazer", "& Other Stories", "Jackets", "suit", 23],
      ["Soft Cashmere Wrap", "Uniqlo", "Accessories", "coat", 12],
      ["Floral Midi Dress", "Rixo", "Dresses", "dress", 34],
      ["The Weekend Coat", "Sézane", "Coats", "coat", 29],
      ["Black Tie Suit", "Suitsupply", "Suits", "suit", 40],
      ["Satin Evening Gown", "Ghost", "Evening Wear", "evening", 38],
      ["Leather Mini Bag", "Arket", "Bags", "bag", 15],
      ["Wool Evening Scarf", "COS", "Accessories", "coat", 14],
    ];
    const luxury: [string, string, string, string, number][] = [
      ["The Heritage Handbag", "Atelier Laurent", "Bags", "bag", 180],
      ["Le Smoking Suit", "Maison Étoile", "Suits", "suit", 145],
      ["The Scarlet Gown", "Valentina Studio", "Evening Wear", "evening", 160],
      ["Sculpture Shoulder Bag", "Maison V", "Bags", "bag", 120],
      ["Parisian Cashmere Coat", "Atelier No. 8", "Coats", "coat", 110],
      ["Midnight Silk Dress", "Maison Étoile", "Dresses", "dress", 130],
      ["Archive Leather Tote", "Atelier Laurent", "Bags", "bag", 95],
      ["The Couture Blazer", "Valentina Studio", "Jackets", "suit", 125],
      ["Signature Satin Heels", "Maison V", "Shoes", "shoes", 85],
      ["Runway Evening Gown", "Atelier No. 8", "Evening Wear", "evening", 195],
    ];
    for (const [index, [title, brand, category, img, price]] of [
      ...normals,
      ...luxury,
    ].entries()) {
      const isLuxury = index >= normals.length;
      await tx.item.create({
        data: {
          id: `item-${index + 1}`,
          title,
          brand,
          category,
          tier: isLuxury ? "LUXURY" : "NORMAL",
          ownerId: isLuxury
            ? ["lina", "maya", "noah"][(index - 22) % 3]
            : index % 3 === 0
              ? "daniel"
              : index % 3 === 1
                ? "amelia"
                : "leo",
          description: `${title}: a beautifully considered piece for the moments worth dressing for. Carefully cared for, professionally cleaned, and ready for its next chapter. All photos are illustrative demo imagery; designer labels and authenticity records are simulated.`,
          size:
            category === "Bags" || category === "Accessories"
              ? "One size"
              : category === "Shoes"
                ? "EU 38"
                : ["S", "M", "L"][index % 3],
          color:
            img === "dress" || img === "evening"
              ? "Red"
              : img === "bag"
                ? "Brown"
                : img === "coat"
                  ? "Beige"
                  : "Black",
          replacementValue: isLuxury ? 450000 : 45000,
          rentalPricePerDay: price * 100,
          securityDeposit: isLuxury ? 150000 : 10000,
          approvalRequired: isLuxury,
          authenticationStatus: isLuxury ? "VERIFIED" : "NOT_REQUIRED",
          images: JSON.stringify([images[img as keyof typeof images]]),
          availableFrom: "2026-09-01",
          availableTo: "2027-12-31",
          location: index % 4 ? "Berlin" : "Hamburg",
          designer: isLuxury ? brand : "",
          collection: isLuxury ? "Autumn / Winter 2026" : "",
          serialNumber: isLuxury ? `DEMO-${1000 + index}` : "",
          certificate: isLuxury ? "Simulated certificate of authenticity" : "",
          proofOfPurchase: isLuxury
            ? "Demo purchase record — no real documents"
            : "",
          insuranceRequired: isLuxury,
          minimumRenterRating: isLuxury ? 4 : 0,
          identityVerificationRequired: isLuxury,
        },
      });
    }
    for (let i = 1; i <= 2; i++) {
      const base = await tx.item.findUniqueOrThrow({
        where: { id: `item-${22 + i}` },
      });
      await tx.item.create({
        data: {
          ...base,
          id: `pending-${i}`,
          title:
            i === 1 ? "Archive Quilted Bag" : "Limited Edition Evening Suit",
          status: "PENDING_APPROVAL",
          authenticationStatus: "PENDING",
        },
      });
    }
    // Seed a completed rental through exactly the same services as interactive bookings.
    const completed = await requestBooking(
      tx,
      {
        itemId: "item-1",
        renterId: "sara",
        startDate: "2026-09-28",
        endDate: "2026-09-30",
        method: "OWNER_SHIPPING",
      },
      "sara",
    );
    for (const action of [
      "pay",
      "prepare",
      "ship",
      "deliver",
      "start",
      "return",
      "returnShip",
      "receive",
      "inspect",
      "pass",
    ])
      await bookingAction(tx, completed.id, action, "admin");
    await tx.review.create({
      data: {
        bookingId: completed.id,
        authorId: "sara",
        targetId: "daniel",
        rating: 5,
        comment:
          "Beautifully cared for and arrived right on time. Would rent again.",
      },
    });
    await advanceClock(tx, "admin", 62);
    await resetScenario(tx, "late", "admin");
    for (const scenario of [
      "normal",
      "luxury",
      "payment",
      "rejection",
      "damage",
      "cancel",
    ])
      await resetScenario(tx, scenario, "admin");
    const booking = await tx.booking.findFirstOrThrow({
      where: { scenarioId: "luxury" },
    });
    await tx.message.create({
      data: {
        bookingId: booking.id,
        senderId: "lina",
        text: "Hi Sara! I’ll include the dust bag and a care guide. Let me know if you have any questions.",
      },
    });
  }, db);
  console.log(
    "Seeded 12 accounts, 32 catalog pieces, 2 approvals, 7 simulator scenarios, and a completed rental.",
  );
}
main().finally(() => db.$disconnect());
