-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('PASSENGER', 'DRIVER', 'DISPATCHER', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "TripRequestSource" AS ENUM ('APP', 'PHONE', 'DISPATCHER', 'OTHER');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('REQUESTED', 'ASSIGNED', 'DRIVER_EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TripOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DispatchSearchStatus" AS ENUM ('SEARCHING', 'WAITING_FOR_RESPONSE', 'NO_CANDIDATES', 'MANUAL_INTERVENTION', 'ASSIGNED', 'STOPPED');

-- CreateEnum
CREATE TYPE "DriverAvailabilityStatus" AS ENUM ('OFFLINE', 'AVAILABLE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "AgencyRole" AS ENUM ('DRIVER', 'DISPATCHER', 'ADMIN');

-- CreateTable
CREATE TABLE "Agency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phoneNormalized" TEXT,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyMembership" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AgencyRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassengerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "phoneNormalized" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PassengerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "availabilityStatus" "DriverAvailabilityStatus" NOT NULL DEFAULT 'OFFLINE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverVehicleAssignment" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverVehicleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverLocation" (
    "driverId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "lat" DECIMAL(10,7) NOT NULL,
    "lng" DECIMAL(10,7) NOT NULL,
    "accuracy" DECIMAL(10,2),
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverLocation_pkey" PRIMARY KEY ("driverId")
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FareVersion" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "versionLabel" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "scale" INTEGER NOT NULL DEFAULT 0,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FareVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FareRule" (
    "id" TEXT NOT NULL,
    "fareVersionId" TEXT NOT NULL,
    "originZoneId" TEXT NOT NULL,
    "destinationZoneId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FareRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "passengerId" TEXT,
    "createdByUserId" TEXT,
    "createdByActorType" "ActorType" NOT NULL,
    "requestSource" "TripRequestSource" NOT NULL,
    "originText" TEXT NOT NULL,
    "destinationText" TEXT NOT NULL,
    "originLat" DECIMAL(10,7),
    "originLng" DECIMAL(10,7),
    "destinationLat" DECIMAL(10,7),
    "destinationLng" DECIMAL(10,7),
    "originZoneId" TEXT,
    "destinationZoneId" TEXT,
    "driverId" TEXT,
    "vehicleId" TEXT,
    "status" "TripStatus" NOT NULL DEFAULT 'REQUESTED',
    "fareAmount" INTEGER NOT NULL,
    "fareCurrency" TEXT NOT NULL,
    "fareVersionId" TEXT,
    "fareScale" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "passengerDisplayName" TEXT,
    "contactPhone" TEXT,
    "referenceNotes" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReasonCode" TEXT,
    "cancelReasonText" TEXT,
    "cancelledByActorType" "ActorType",
    "cancelledByUserId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispatchSearch" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "status" "DispatchSearchStatus" NOT NULL DEFAULT 'SEARCHING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastEvaluatedAt" TIMESTAMP(3),
    "stoppedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DispatchSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripOffer" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "rank" INTEGER NOT NULL,
    "distanceSnapshot" INTEGER NOT NULL,
    "status" "TripOfferStatus" NOT NULL DEFAULT 'PENDING',
    "offeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "response" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripEvent" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorUserId" TEXT,
    "fromStatus" "TripStatus",
    "toStatus" "TripStatus",
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT,
    "actorUserId" TEXT,
    "actorType" "ActorType" NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "resultResourceType" TEXT,
    "resultResourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNormalized_key" ON "User"("phoneNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "AgencyMembership_userId_isActive_idx" ON "AgencyMembership"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AgencyMembership_agencyId_userId_role_key" ON "AgencyMembership"("agencyId", "userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "PassengerProfile_userId_key" ON "PassengerProfile"("userId");

-- CreateIndex
CREATE INDEX "Driver_agencyId_availabilityStatus_isEnabled_idx" ON "Driver"("agencyId", "availabilityStatus", "isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_agencyId_userId_key" ON "Driver"("agencyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_agencyId_plate_key" ON "Vehicle"("agencyId", "plate");

-- CreateIndex
CREATE INDEX "DriverVehicleAssignment_driverId_isCurrent_idx" ON "DriverVehicleAssignment"("driverId", "isCurrent");

-- CreateIndex
CREATE INDEX "DriverVehicleAssignment_vehicleId_isCurrent_idx" ON "DriverVehicleAssignment"("vehicleId", "isCurrent");

-- CreateIndex
CREATE INDEX "DriverLocation_agencyId_recordedAt_idx" ON "DriverLocation"("agencyId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Zone_agencyId_code_key" ON "Zone"("agencyId", "code");

-- CreateIndex
CREATE INDEX "FareVersion_agencyId_effectiveFrom_effectiveTo_idx" ON "FareVersion"("agencyId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "FareRule_originZoneId_destinationZoneId_idx" ON "FareRule"("originZoneId", "destinationZoneId");

-- CreateIndex
CREATE UNIQUE INDEX "FareRule_fareVersionId_originZoneId_destinationZoneId_key" ON "FareRule"("fareVersionId", "originZoneId", "destinationZoneId");

-- CreateIndex
CREATE INDEX "Trip_agencyId_status_createdAt_idx" ON "Trip"("agencyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Trip_passengerId_createdAt_idx" ON "Trip"("passengerId", "createdAt");

-- CreateIndex
CREATE INDEX "Trip_driverId_status_idx" ON "Trip"("driverId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DispatchSearch_tripId_key" ON "DispatchSearch"("tripId");

-- CreateIndex
CREATE INDEX "TripOffer_tripId_status_idx" ON "TripOffer"("tripId", "status");

-- CreateIndex
CREATE INDEX "TripOffer_driverId_status_idx" ON "TripOffer"("driverId", "status");

-- CreateIndex
CREATE INDEX "TripOffer_status_expiresAt_idx" ON "TripOffer"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "TripEvent_tripId_createdAt_idx" ON "TripEvent"("tripId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_agencyId_createdAt_idx" ON "AuditLog"("agencyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_scope_key_key" ON "IdempotencyRecord"("scope", "key");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyMembership" ADD CONSTRAINT "AgencyMembership_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyMembership" ADD CONSTRAINT "AgencyMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassengerProfile" ADD CONSTRAINT "PassengerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverVehicleAssignment" ADD CONSTRAINT "DriverVehicleAssignment_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverVehicleAssignment" ADD CONSTRAINT "DriverVehicleAssignment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverVehicleAssignment" ADD CONSTRAINT "DriverVehicleAssignment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverLocation" ADD CONSTRAINT "DriverLocation_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverLocation" ADD CONSTRAINT "DriverLocation_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FareVersion" ADD CONSTRAINT "FareVersion_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FareRule" ADD CONSTRAINT "FareRule_fareVersionId_fkey" FOREIGN KEY ("fareVersionId") REFERENCES "FareVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FareRule" ADD CONSTRAINT "FareRule_originZoneId_fkey" FOREIGN KEY ("originZoneId") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FareRule" ADD CONSTRAINT "FareRule_destinationZoneId_fkey" FOREIGN KEY ("destinationZoneId") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "PassengerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_originZoneId_fkey" FOREIGN KEY ("originZoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_destinationZoneId_fkey" FOREIGN KEY ("destinationZoneId") REFERENCES "Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_fareVersionId_fkey" FOREIGN KEY ("fareVersionId") REFERENCES "FareVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispatchSearch" ADD CONSTRAINT "DispatchSearch_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripOffer" ADD CONSTRAINT "TripOffer_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripOffer" ADD CONSTRAINT "TripOffer_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripOffer" ADD CONSTRAINT "TripOffer_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripOffer" ADD CONSTRAINT "TripOffer_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripEvent" ADD CONSTRAINT "TripEvent_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripEvent" ADD CONSTRAINT "TripEvent_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripEvent" ADD CONSTRAINT "TripEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Application invariants not expressible in Prisma schema
CREATE UNIQUE INDEX "TripOffer_one_pending_per_trip_uq"
ON "TripOffer" ("tripId")
WHERE "status" = 'PENDING';

CREATE UNIQUE INDEX "TripOffer_one_pending_per_driver_uq"
ON "TripOffer" ("driverId")
WHERE "status" = 'PENDING';

CREATE UNIQUE INDEX "DriverVehicleAssignment_one_current_per_driver_uq"
ON "DriverVehicleAssignment" ("driverId")
WHERE "isCurrent" = true;

CREATE UNIQUE INDEX "DriverVehicleAssignment_one_current_per_vehicle_uq"
ON "DriverVehicleAssignment" ("vehicleId")
WHERE "isCurrent" = true;

ALTER TABLE "User"
ADD CONSTRAINT "User_email_or_phone_required_ck"
CHECK ("email" IS NOT NULL OR "phoneNormalized" IS NOT NULL);
