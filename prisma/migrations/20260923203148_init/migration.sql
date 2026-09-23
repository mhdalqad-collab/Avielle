-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "avatar" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "identityVerified" BOOLEAN NOT NULL DEFAULT false,
    "rating" REAL NOT NULL DEFAULT 4.8,
    "bio" TEXT NOT NULL DEFAULT '',
    "username" TEXT NOT NULL DEFAULT '',
    "followers" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "gender" TEXT NOT NULL DEFAULT 'Unisex',
    "color" TEXT NOT NULL,
    "condition" TEXT NOT NULL DEFAULT 'Excellent',
    "replacementValue" INTEGER NOT NULL,
    "rentalPricePerDay" INTEGER NOT NULL,
    "securityDeposit" INTEGER NOT NULL,
    "location" TEXT NOT NULL DEFAULT 'Berlin',
    "deliveryOptions" TEXT NOT NULL DEFAULT 'OWNER_SHIPPING,PLATFORM_COURIER,LOCAL_PICKUP',
    "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
    "authenticationStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "availableFrom" TEXT NOT NULL DEFAULT '2026-10-01',
    "availableTo" TEXT NOT NULL DEFAULT '2027-12-31',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "images" TEXT NOT NULL,
    "designer" TEXT NOT NULL DEFAULT '',
    "collection" TEXT NOT NULL DEFAULT '',
    "year" INTEGER NOT NULL DEFAULT 2025,
    "serialNumber" TEXT NOT NULL DEFAULT '',
    "proofOfPurchase" TEXT NOT NULL DEFAULT '',
    "certificate" TEXT NOT NULL DEFAULT '',
    "insuranceRequired" BOOLEAN NOT NULL DEFAULT false,
    "minimumRenterRating" REAL NOT NULL DEFAULT 0,
    "identityVerificationRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Item_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "renterId" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BOOKING_REQUESTED',
    "rental" INTEGER NOT NULL,
    "serviceFee" INTEGER NOT NULL,
    "deliveryFee" INTEGER NOT NULL,
    "insuranceFee" INTEGER NOT NULL DEFAULT 0,
    "depositAmount" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "lateFee" INTEGER NOT NULL DEFAULT 0,
    "overdue" BOOLEAN NOT NULL DEFAULT false,
    "scenarioId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Booking_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Booking_renterId_fkey" FOREIGN KEY ("renterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "amount" INTEGER NOT NULL,
    "refunded" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SecurityDeposit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "amount" INTEGER NOT NULL,
    "captured" INTEGER NOT NULL DEFAULT 0,
    "released" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SecurityDeposit_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OwnerPayout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PAID',
    CONSTRAINT "OwnerPayout_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "tracking" TEXT NOT NULL,
    CONSTRAINT "Delivery_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeliveryEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deliveryId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "simulatedAt" TEXT NOT NULL,
    CONSTRAINT "DeliveryEvent_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConditionReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "photos" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "simulatedAt" TEXT NOT NULL,
    CONSTRAINT "ConditionReport_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DamageClaim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "decision" TEXT,
    "deduction" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "DamageClaim_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "claimId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    CONSTRAINT "Dispute_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "DamageClaim" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BookingStatusHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT NOT NULL,
    "oldState" TEXT NOT NULL,
    "newState" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "simulatedAt" TEXT NOT NULL,
    CONSTRAINT "BookingStatusHistory_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bookingId" TEXT,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "simulatedAt" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "PlatformEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "oldState" TEXT NOT NULL DEFAULT '',
    "newState" TEXT NOT NULL DEFAULT '',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "simulatedAt" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "SimulatorSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "bookingId" TEXT,
    "initialState" TEXT NOT NULL DEFAULT 'BOOKING_REQUESTED'
);

-- CreateTable
CREATE TABLE "PlatformClock" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'clock',
    "now" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "Item_tier_status_idx" ON "Item"("tier", "status");

-- CreateIndex
CREATE INDEX "Booking_itemId_startDate_endDate_idx" ON "Booking"("itemId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "Booking_scenarioId_idx" ON "Booking"("scenarioId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_bookingId_key" ON "Payment"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityDeposit_bookingId_key" ON "SecurityDeposit"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "OwnerPayout_bookingId_key" ON "OwnerPayout"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_bookingId_key" ON "Delivery"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "ConditionReport_bookingId_phase_key" ON "ConditionReport"("bookingId", "phase");

-- CreateIndex
CREATE UNIQUE INDEX "DamageClaim_bookingId_key" ON "DamageClaim"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Dispute_claimId_key" ON "Dispute"("claimId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_bookingId_authorId_key" ON "Review"("bookingId", "authorId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "PlatformEvent_entityId_idx" ON "PlatformEvent"("entityId");
