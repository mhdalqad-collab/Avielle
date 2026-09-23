# Avielle — The shared wardrobe

A functional local fashion rental marketplace and process simulator. Everyday (`NORMAL`) and `LUXURY` inventory share one booking engine, database, account switcher, and design system.

This prototype includes catalog discovery, dated availability, checkout, approval, simulated payments and deposits, shipping and pickup, returns, condition evidence, damage claims, disputes, messaging, reviews, notifications, owner listings, and marketplace administration. The simulator invokes the same application services as customer and owner actions.

## Run locally

Requires **Node.js 22.13+** (Node 24 recommended) and npm. No external services or accounts are needed.

```bash
npm install
```

Copy `.env.example` to `.env` if it does not already exist, then set it to your Neon connection string:

```text
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
```

Then:

```bash
npm run db:setup
npm run dev
```

Open **http://localhost:3000**. `db:setup` applies the PostgreSQL migration and seeds the database. For Vercel, add the same `DATABASE_URL` in the Production, Preview, and Development environment variables, then redeploy.

Production preview:

```bash
npm run build
npm start
```

Useful commands:

```bash
npm run typecheck
npm test
npm run format
npm run seed
npx prisma studio
```

For schema changes, stop the running app on Windows before `npx prisma migrate dev --name description`, because the running process locks Prisma’s engine DLL. Restart afterward. Seeding is idempotent: an existing database is preserved. Use **Reset scenario** to repeat demonstrations without deleting marketplace data.

## Demo accounts

Use the account selector in the header. There are no credentials or real authentication.

| Account | Role | Typical actions |
| --- | --- | --- |
| Sara Müller | Renter | Book, pay, confirm receipt, return, message, review |
| Daniel Weber | Everyday owner | List items, prepare, dispatch, inspect, review |
| Lina Laurent | Verified luxury owner / influencer | Approve requests and manage her luxury pieces |
| Maya Chen, Noah Rossi | Verified influencers | Additional curated luxury closets |
| Amelia Fischer, Leo Martin | Everyday owners | Additional everyday inventory |
| Admin | Administrator | Approvals, authentication, users, refunds, disputes, simulator |
| Sofia, Oliver, Ella, Lucas | Renters | Additional demo accounts |

The seed includes 12 accounts, 3 influencers, 22 everyday pieces, 10 active luxury pieces, 2 pending luxury approvals, a completed reviewed rental, and 7 scenario bookings. Scenario inventory is isolated from the public catalog so demonstrations do not consume ordinary inventory availability.

## Try the normal marketplace

1. As Sara, browse **Explore**, choose an item, and select rental dates.
2. Review the price, service fee, delivery, optional simulated protection, and refundable deposit.
3. Reserve the piece. For luxury, the owner approves before payment.
4. Complete simulated payment as Sara. Switch to the named owner to prepare and dispatch.
5. Switch back to Sara to confirm delivery and start the rental. The rental cannot start before its start date; Admin can advance the platform clock.
6. Request the return and mark it sent. The owner receives and inspects it.
7. Passing inspection completes the booking, releases the deposit, and sends the simulated payout.
8. Both participants can leave a review. Messages, evidence, delivery tracking, and the event timeline remain on the booking.

The UI only offers actions applicable to the current role and booking state. The server checks the same rules independently. Admin can perform legal participant actions for demonstrations; it cannot jump directly between arbitrary booking states.

## Simulator

Open **http://localhost:3000/admin/simulator** and choose **Continue as Admin**.

| Scenario | Initial state | Demonstration |
| --- | --- | --- |
| Successful everyday rental | Payment pending | Full standard lifecycle |
| Successful luxury rental | Awaiting approval | Eligibility, approval, large deposit, full lifecycle |
| Payment failure & retry | Payment pending | Click **Fail payment**, then **Retry payment** |
| Owner rejects a booking | Awaiting approval | Decline, close booking, release reservation |
| Damage claim & dispute | Dispute | Compare evidence; choose responsibility and deduction; settle and complete |
| Late return | Rental active, overdue | Existing late fee; advance time, return, and settle final charge |
| Cancellation & refunds | Confirmed | Select renter / owner / platform cancellation |

The failure panel supports payment failure, deposit authorization failure, identity failure, authentication failure, a 24-hour delivery delay, owner rejection, damage, and late return. Identity and authentication can be restored. A delayed shipment cannot be marked delivered until the virtual clock reaches its persisted delay deadline.

**Clock:** +1 hour, +1 day, +3 days, rental start, or return deadline. All dates and cutoff rules use UTC. The clock is shared across the platform; advancing it can affect other open bookings. It never moves backwards.

**Reset:** recreates only the selected scenario’s booking and related records, restores its simulated item, and re-verifies Sara’s demo identity. Fresh rental dates are relative to the current platform time. Damage and late scenarios are rebuilt by running normal services through their respective paths. The late scenario advances the shared clock by 80 hours. Other bookings are preserved; their reminders and late fees can change when time advances. Reset a scenario if its dates have expired while exploring another scenario.

The simulator displays actors, booking, item, payment, deposit, delivery, eligibility, financial breakdown, available actions, and auditable events. Failures are recorded as domain events rather than client-only animations.

## Business rules

- Money is stored and calculated in **integer euro cents**.
- Rental dates are **inclusive**, between 1 and 60 days. A three-day rental from October 1 through October 3 costs three daily rates.
- Open requests, pending payments, and confirmed/in-progress bookings reserve dates. Overlaps, including a shared end/start day, are rejected inside a database transaction. Cancelled, rejected, and completed rentals release their date reservations.
- Service fee: **10%** of rental price. Owner shipping: **€8**; platform courier: **€15**; local pickup: **€0**. Optional simulated protection: **5%** of rental price, required when specified by a luxury listing.
- Luxury booking and payment check active accounts, owner verification, item authentication, identity when required, minimum renter rating, and insurance selection. Payment confirmation authorizes the deposit and captures rental charges atomically.
- The deposit stays held through return inspection or dispute. A deduction cannot exceed the deposit or the documented claim. Resolution releases the remaining balance. Cancelling an uncharged authorization does not invent a cash refund.
- Successful payout: **80% of the rental price minus applicable payment refunds**, floored at zero, plus accrued late fees. Service fees, delivery, insurance, and refundable deposits are not rental earnings. Payouts cannot be issued twice.
- Returns are due at the end of the final rental day (UTC). There is a **six-hour grace period**; each started late day after that costs one daily rental rate. Fees stop accruing when the owner receives the item and are captured at completion.
- Renter cancellation at least 48 hours before rental start: full rental-charge refund. Later cancellation: 50%. Owner/platform cancellation: full refund. Held deposits are released. Cancellation is allowed only before dispatch.
- Admin refunds cannot exceed the remaining captured balance and are unavailable after payout. Claim resolution supports no damage, renter responsibility, owner responsibility, and shared responsibility. Admin explicitly chooses the deduction amount; it is recorded in the audit trail.
- Reviews are available after completion, once per participant per booking. Renter reviews reference both the booked item and its owner; owner reviews target the renter. Received reviews update the recipient’s rating.
- Listing suspension and maintenance holds survive rental completion. Multiple non-overlapping bookings do not incorrectly reset an item’s current physical status.

## Architecture

```text
React screens and simulator
          ↓
Validated Next.js route handlers
          ↓
Application services + guarded state machine + pricing
          ↓
Prisma transaction / repositories
          ↓
PostgreSQL (Neon)
```

| Area | Files |
| --- | --- |
| Models and relations | `prisma/schema.prisma`, `prisma/migrations/` |
| Seed scenarios and inventory | `prisma/seed.ts` |
| Pure state transitions, dates, pricing | `lib/domain.ts` |
| Booking, payment, deposit, delivery, damage, events, notifications, inventory | `lib/services.ts` |
| Simulator orchestration | `lib/simulator.ts` |
| Shared scenario descriptions | `lib/scenario-catalog.ts` |
| Read model | `lib/snapshot.ts` |
| Validated mutation API | `app/api/action/route.ts` |
| Image uploads and dynamic delivery | `app/api/upload/route.ts`, `app/uploads/[name]/route.ts` |
| Shared client state and account preference | `components/context.tsx`, `components/Marketplace.tsx` |
| Storefront / rental / owner / admin views | `components/` |

The server owns all authoritative business state. The only browser-storage value is the selected demo account. Mutations are atomic; any failure rolls back payment, deposit, history, and event changes together. Domain events and their notification handlers run in-process, within the same transaction. Simulator code imports services; services never import the simulator.

Prisma entities include User, Item, Booking, Payment, SecurityDeposit, OwnerPayout, Delivery, DeliveryEvent, ConditionReport, DamageClaim, Dispute, Message, Review, BookingStatusHistory, Notification, PlatformEvent, SimulatorSession, and PlatformClock. Small prototype concepts such as influencer profiles, verification, authentication, item availability, and conversation participants are represented by fields/relations on these entities rather than extra one-to-one tables. Images and evidence paths use validated JSON arrays.

Stack: Next.js 15, React 19, strict TypeScript, Prisma 6, PostgreSQL (Neon), Zod, Lucide, and a responsive custom CSS design system. No microservices, message broker, real payments, identity documents, courier APIs, banking, or external insurance.

## Routes

| Route | Screen |
| --- | --- |
| `/` | Homepage |
| `/explore`, `/luxury`, `/everyday` | Search and discovery |
| `/influencers` | Influencer closets |
| `/items/[id]`, `/checkout/[itemId]` | Item detail / dated booking checkout |
| `/bookings/[id]` | Rental workflow, evidence, payments, messaging, reviews |
| `/dashboard` | Account overview |
| `/dashboard/items`, `/dashboard/new` | Owner inventory / listing creation |
| `/dashboard/rentals` | Participant bookings |
| `/dashboard/messages`, `/dashboard/notifications` | Conversations / updates |
| `/admin` | Marketplace overview |
| `/admin/users`, `/admin/items`, `/admin/bookings` | Management |
| `/admin/luxury`, `/admin/authentication` | Luxury review |
| `/admin/payments`, `/admin/deposits` | Financial records |
| `/admin/claims`, `/admin/disputes` | Evidence and resolution |
| `/admin/events`, `/admin/simulator` | Audit log / system simulator |

API: `GET /api/state` provides the prototype read model. `POST /api/action` accepts `{ actor, kind, id?, action?, data? }` and validates server-side using Zod. `POST /api/upload` accepts JPEG/PNG/WebP images up to 5 MB and checks file signatures. Files are stored locally in `public/uploads/` and served by a validated route.

## Validation

`npm test` uses real Prisma transactions against a disposable test database. It does **not** modify the demo database. Coverage includes date boundaries and concurrent conflicts, normal/luxury success, eligibility, invalid transitions and rollback, role enforcement, payment failure/retry, deposits, partial/full damage settlement, late fees, cancellation refunds, payouts, listing policies, pickup, delivery delay, admin suspension, and scenario isolation.

Use `npm run typecheck` and `npm run build` to validate the application. Browser QA covers responsive storefront and simulator layouts, luxury approval/payment/fulfillment/return, and persisted completion outcomes.

## Prototype boundaries

This is deliberately a **local demonstration** with openly switchable demo accounts, not a production-authenticated service. The snapshot contains the demo marketplace’s records so testers can inspect workflows. All financial, identity, authenticity, and protection outcomes are simulations. Uploaded photos remain on the local machine; do not use real identity or payment documents. The catalog uses illustrative photography and fictional luxury labels rather than verified merchandise. The data and files persist across restarts; there is no multi-instance synchronization, external messaging, or background worker. Time-based automation runs when the virtual clock advances.

## Photography

Illustrative photos from Pexels, downloaded locally for reliable catalog rendering. See [ASSETS.md](ASSETS.md) for source pages and photographers. Optional web fonts fall back to system fonts when offline.
