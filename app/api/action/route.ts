import { z } from "zod";
import { db } from "@/lib/db";
import {
  advanceClock,
  bookingAction,
  createListing,
  emit,
  now,
  requestBooking,
  requestSchema,
  requireAdmin,
  runTransaction,
} from "@/lib/services";
import { resetScenario } from "@/lib/simulator";
const schema = z.object({
  actor: z.string(),
  kind: z.enum([
    "book",
    "booking",
    "clock",
    "scenario",
    "verify",
    "authenticate",
    "listing",
    "item",
    "user",
    "message",
    "review",
    "read",
  ]),
  id: z.string().optional(),
  action: z.string().optional(),
  data: z.record(z.unknown()).default({}),
});
export async function POST(request: Request) {
  try {
    const { actor, kind, id, action, data } = schema.parse(
      await request.json(),
    );
    const result = await runTransaction(async (tx) => {
      const u = await tx.user.findUniqueOrThrow({ where: { id: actor } });
      if (!u.active) throw new Error("This account is suspended.");
      const requiredId = () => z.string().min(1).parse(id);
      switch (kind) {
        case "book":
          return requestBooking(
            tx,
            requestSchema.parse({ ...data, renterId: actor }),
            actor,
          );
        case "booking":
          return bookingAction(
            tx,
            requiredId(),
            z.string().parse(action),
            actor,
            z
              .object({
                fail: z.boolean().optional(),
                failure: z.string().optional(),
                notes: z.string().max(2000).optional(),
                photos: z.string().optional(),
                amount: z.number().int().nonnegative().optional(),
                decision: z.string().optional(),
                cancelBy: z.enum(["RENTER", "OWNER", "PLATFORM"]).optional(),
              })
              .parse(data),
          );
        case "clock":
          return advanceClock(
            tx,
            actor,
            z.number().min(1).max(720).optional().parse(data.hours),
            z.string().datetime().optional().parse(data.target),
          );
        case "scenario":
          return resetScenario(tx, requiredId(), actor);
        case "verify": {
          const target = id || actor;
          if (target !== actor) await requireAdmin(tx, actor);
          const verified = data.fail !== true;
          if (!verified) await requireAdmin(tx, actor);
          await tx.user.update({
            where: { id: target },
            data: { identityVerified: verified },
          });
          await emit(
            tx,
            verified ? "IDENTITY_VERIFIED" : "IDENTITY_VERIFICATION_FAILED",
            target,
            actor,
            {},
            "",
            "",
            "User",
          );
          return { verified };
        }
        case "authenticate": {
          await requireAdmin(tx, actor);
          const status = data.fail ? "REJECTED" : "VERIFIED";
          const item = await tx.item.update({
            where: { id: requiredId() },
            data: { authenticationStatus: status },
          });
          await emit(
            tx,
            "AUTHENTICATION_" + status,
            item.id,
            actor,
            {},
            "",
            "",
            "Item",
          );
          return item;
        }
        case "listing":
          return createListing(tx, actor, data);
        case "item": {
          const item = await tx.item.findUniqueOrThrow({
            where: { id: requiredId() },
            include: { owner: true },
          });
          if (action === "approve") {
            await requireAdmin(tx, actor);
            if (
              item.tier === "LUXURY" &&
              (item.authenticationStatus !== "VERIFIED" || !item.owner.verified)
            )
              throw new Error(
                "Verify the owner and authenticate this item first.",
              );
            await tx.item.update({
              where: { id: item.id },
              data: { status: "ACTIVE" },
            });
          } else {
            if (u.role !== "ADMIN" && item.ownerId !== actor)
              throw new Error("Only the owner can manage this listing.");
            const status = z
              .enum(["SUSPENDED", "ACTIVE", "MAINTENANCE"])
              .parse(data.status);
            if (item.status === "PENDING_APPROVAL" && u.role !== "ADMIN")
              throw new Error("Admin approval is required.");
            if (
              status === "ACTIVE" &&
              item.tier === "LUXURY" &&
              (item.authenticationStatus !== "VERIFIED" || !item.owner.verified)
            )
              throw new Error(
                "Luxury verification must pass before activation.",
              );
            await tx.item.update({ where: { id: item.id }, data: { status } });
          }
          await emit(
            tx,
            "LISTING_UPDATED",
            item.id,
            actor,
            data,
            "",
            "",
            "Item",
          );
          return item;
        }
        case "user": {
          await requireAdmin(tx, actor);
          const patch = z
            .object({
              active: z.boolean().optional(),
              verified: z.boolean().optional(),
            })
            .parse(data);
          if (id === actor && patch.active === false)
            throw new Error(
              "The demo administrator cannot suspend their own account.",
            );
          await tx.user.update({ where: { id: requiredId() }, data: patch });
          await emit(
            tx,
            "USER_UPDATED",
            requiredId(),
            actor,
            patch,
            "",
            "",
            "User",
          );
          return { ok: true };
        }
        case "message": {
          const b = await tx.booking.findUniqueOrThrow({
            where: { id: requiredId() },
            include: { item: true },
          });
          if (
            ![b.renterId, b.item.ownerId].includes(actor) &&
            u.role !== "ADMIN"
          )
            throw new Error(
              "Only participants can message about this booking.",
            );
          const text = z.string().trim().min(1).max(2000).parse(data.text);
          const message = await tx.message.create({
            data: { bookingId: b.id, senderId: actor, text },
          });
          await emit(tx, "MESSAGE_RECEIVED", b.id, actor);
          return message;
        }
        case "review": {
          const b = await tx.booking.findUniqueOrThrow({
            where: { id: requiredId() },
            include: { item: true },
          });
          if (b.status !== "COMPLETED")
            throw new Error("Reviews are available after completion.");
          if (![b.renterId, b.item.ownerId].includes(actor))
            throw new Error("Only booking participants can leave a review.");
          const p = z
            .object({
              rating: z.number().int().min(1).max(5),
              comment: z.string().trim().min(3).max(1000),
            })
            .parse(data);
          const targetId = actor === b.renterId ? b.item.ownerId : b.renterId;
          const review = await tx.review.create({
            data: { ...p, bookingId: b.id, authorId: actor, targetId },
          });
          const ratings = await tx.review.aggregate({
            where: { targetId },
            _avg: { rating: true },
          });
          await tx.user.update({
            where: { id: targetId },
            data: { rating: ratings._avg.rating ?? 5 },
          });
          await emit(tx, "REVIEW_CREATED", b.id, actor);
          return review;
        }
        case "read":
          await tx.notification.updateMany({
            where: { userId: actor },
            data: { read: true },
          });
          return { ok: true };
      }
    });
    return Response.json({ ok: true, result });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof z.ZodError
            ? e.issues
                .map((i) => `${i.path.join(".")}: ${i.message}`)
                .join("; ")
            : e instanceof Error
              ? e.message
              : "Unable to complete this action.",
      },
      { status: 400 },
    );
  }
}
