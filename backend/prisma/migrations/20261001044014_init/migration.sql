-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CASHIER');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "AppointmentFeeType" AS ENUM ('FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AppointmentCompletionType" AS ENUM ('SERVICE_SETTLEMENT', 'NO_SERVICE_CLOSURE');

-- CreateEnum
CREATE TYPE "StaffAssignmentMode" AS ENUM ('SPECIFIC', 'ANY_AVAILABLE');

-- CreateEnum
CREATE TYPE "AppointmentServiceMembershipStatus" AS ENUM ('ACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "AppointmentServiceOutcome" AS ENUM ('SCHEDULED', 'PERFORMED', 'NOT_PERFORMED');

-- CreateEnum
CREATE TYPE "RescheduleEventType" AS ENUM ('ORDINARY_RESCHEDULE', 'NO_SHOW_RECOVERY_CREATED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('ADMIN', 'CASHIER', 'CUSTOMER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('APPOINTMENT_FEE', 'SERVICE_PAYMENT');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'GCASH', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentReconciliationStatus" AS ENUM ('NONE', 'REQUIRED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "NotificationEventType" AS ENUM ('BOOKING_CONFIRMED', 'BOOKING_RESCHEDULED', 'BOOKING_CANCELLED', 'NO_SHOW_RECOVERY_CREATED', 'PAYMENT_RECEIVED', 'APPOINTMENT_COMPLETED', 'APPOINTMENT_REMINDER');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "bufferMinutes" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffService" (
    "id" UUID NOT NULL,
    "staffId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "commissionRate" DECIMAL(5,4) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StaffService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalonOperatingHour" (
    "id" UUID NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "openTime" TIME(0) NOT NULL,
    "closeTime" TIME(0) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SalonOperatingHour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalonClosure" (
    "id" UUID NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SalonClosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffSchedule" (
    "id" UUID NOT NULL,
    "staffId" UUID NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "startTime" TIME(0) NOT NULL,
    "endTime" TIME(0) NOT NULL,
    "effectiveFrom" DATE,
    "effectiveTo" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StaffSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffUnavailability" (
    "id" UUID NOT NULL,
    "staffId" UUID NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StaffUnavailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingPolicyVersion" (
    "id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "appointmentFeeType" "AppointmentFeeType" NOT NULL,
    "appointmentFeeAmount" DECIMAL(12,2) NOT NULL,
    "bookingHoldMinutes" INTEGER NOT NULL,
    "defaultBufferMinutes" INTEGER NOT NULL,
    "maxReschedules" INTEGER NOT NULL,
    "rescheduleCutoffHours" INTEGER NOT NULL,
    "cancellationCutoffHours" INTEGER NOT NULL,
    "noShowGraceHours" INTEGER NOT NULL,
    "advanceBookingDays" INTEGER NOT NULL,
    "minimumBookingLeadMinutes" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMPTZ(3) NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingPolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" UUID NOT NULL,
    "bookingCode" TEXT NOT NULL,
    "customerId" UUID NOT NULL,
    "bookingPolicyVersionId" UUID NOT NULL,
    "status" "AppointmentStatus" NOT NULL,
    "startAt" TIMESTAMPTZ(3) NOT NULL,
    "endAt" TIMESTAMPTZ(3) NOT NULL,
    "appointmentFeeAmount" DECIMAL(12,2) NOT NULL,
    "holdExpiresAt" TIMESTAMPTZ(3),
    "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
    "guestAccessTokenHash" TEXT NOT NULL,
    "confirmedAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "noShowAt" TIMESTAMPTZ(3),
    "noShowGraceExpiresAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "completionType" "AppointmentCompletionType",
    "completedByUserId" UUID,
    "recoveryOfAppointmentId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "carriedAppointmentFeePaymentId" UUID,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentService" (
    "id" UUID NOT NULL,
    "appointmentId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "staffId" UUID NOT NULL,
    "assignmentMode" "StaffAssignmentMode" NOT NULL,
    "membershipStatus" "AppointmentServiceMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "sequenceNo" INTEGER NOT NULL,
    "serviceNameSnapshot" TEXT NOT NULL,
    "priceSnapshot" DECIMAL(12,2) NOT NULL,
    "durationMinutesSnapshot" INTEGER NOT NULL,
    "bufferMinutesSnapshot" INTEGER NOT NULL,
    "commissionRateSnapshot" DECIMAL(5,4) NOT NULL,
    "scheduledStartAt" TIMESTAMPTZ(3) NOT NULL,
    "scheduledEndAt" TIMESTAMPTZ(3) NOT NULL,
    "reservedUntilAt" TIMESTAMPTZ(3) NOT NULL,
    "outcome" "AppointmentServiceOutcome" NOT NULL DEFAULT 'SCHEDULED',
    "actualChargedAmount" DECIMAL(12,2),
    "outcomeFinalizedAt" TIMESTAMPTZ(3),
    "outcomeFinalizedByUserId" UUID,
    "removedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AppointmentService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentRescheduleHistory" (
    "id" UUID NOT NULL,
    "appointmentId" UUID NOT NULL,
    "eventType" "RescheduleEventType" NOT NULL,
    "rescheduleNumber" INTEGER NOT NULL,
    "snapshotSchemaVersion" INTEGER NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorUserId" UUID,
    "actorCustomerId" UUID,
    "beforeSnapshot" JSONB NOT NULL,
    "afterSnapshot" JSONB NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentRescheduleHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "appointmentId" UUID NOT NULL,
    "type" "PaymentType" NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "idempotencyKey" TEXT NOT NULL,
    "externalReference" TEXT,
    "satisfiesObligation" BOOLEAN NOT NULL DEFAULT false,
    "recordedByUserId" UUID,
    "paidAt" TIMESTAMPTZ(3),
    "failedAt" TIMESTAMPTZ(3),
    "refundedAt" TIMESTAMPTZ(3),
    "reconciliationStatus" "PaymentReconciliationStatus" NOT NULL DEFAULT 'NONE',
    "reconciliationReason" TEXT,
    "reconciledAt" TIMESTAMPTZ(3),
    "reconciledByUserId" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "issuedByUserId" UUID NOT NULL,
    "receiptSnapshot" JSONB NOT NULL,
    "issuedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionRecord" (
    "id" UUID NOT NULL,
    "appointmentId" UUID NOT NULL,
    "appointmentServiceId" UUID NOT NULL,
    "staffId" UUID NOT NULL,
    "sourcePaymentId" UUID NOT NULL,
    "serviceAmount" DECIMAL(12,2) NOT NULL,
    "allocatedAppointmentFee" DECIMAL(12,2) NOT NULL,
    "commissionBase" DECIMAL(12,2) NOT NULL,
    "commissionRate" DECIMAL(5,4) NOT NULL,
    "commissionAmount" DECIMAL(12,2) NOT NULL,
    "finalizedByUserId" UUID NOT NULL,
    "finalizedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CommissionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorUserId" UUID,
    "actorCustomerId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeData" JSONB,
    "afterData" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationQueue" (
    "id" UUID NOT NULL,
    "appointmentId" UUID,
    "customerId" UUID,
    "eventType" "NotificationEventType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "recipient" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "NotificationStatus" NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMPTZ(3) NOT NULL,
    "sentAt" TIMESTAMPTZ(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "NotificationQueue_pkey" PRIMARY KEY ("id")
);

-- Add Service CHECK constraints

ALTER TABLE "Service"
ADD CONSTRAINT "Service_price_positive_chk"
CHECK ("price" > 0),

ADD CONSTRAINT "Service_duration_positive_chk"
CHECK ("durationMinutes" > 0),

ADD CONSTRAINT "Service_buffer_nonnegative_chk"
CHECK ("bufferMinutes" IS NULL OR "bufferMinutes" >= 0);

-- Add StaffService commission check

ALTER TABLE "StaffService"
ADD CONSTRAINT "StaffService_commission_rate_range_chk"
CHECK (
    "commissionRate" >= 0
    AND "commissionRate" <= 1
);

-- Add scheduling interval checks
-- Salon operating hours
ALTER TABLE "SalonOperatingHour"
ADD CONSTRAINT "SalonOperatingHour_open_before_close_chk"
CHECK ("openTime" < "closeTime");

-- Salon closure
ALTER TABLE "SalonClosure"
ADD CONSTRAINT "SalonClosure_start_before_end_chk"
CHECK ("startsAt" < "endsAt");

-- Staff schedule
ALTER TABLE "StaffSchedule"
ADD CONSTRAINT "StaffSchedule_start_before_end_chk"
CHECK ("startTime" < "endTime"),

ADD CONSTRAINT "StaffSchedule_effective_dates_chk"
CHECK (
    "effectiveFrom" IS NULL
    OR "effectiveTo" IS NULL
    OR "effectiveFrom" <= "effectiveTo"
);

-- Staff unavailability
ALTER TABLE "StaffUnavailability"
ADD CONSTRAINT "StaffUnavailability_start_before_end_chk"
CHECK ("startsAt" < "endsAt");




-- Add AppointmentService checks
ALTER TABLE "AppointmentService"
ADD CONSTRAINT "AppointmentService_active_sequence_positive_chk"
CHECK (
    "membershipStatus" <> 'ACTIVE'
    OR "sequenceNo" > 0
),

ADD CONSTRAINT "AppointmentService_active_schedule_order_chk"
CHECK (
    "membershipStatus" <> 'ACTIVE'
    OR "scheduledStartAt" < "scheduledEndAt"
),

ADD CONSTRAINT "AppointmentService_active_reserved_interval_chk"
CHECK (
    "membershipStatus" <> 'ACTIVE'
    OR "scheduledEndAt" <= "reservedUntilAt"
),

ADD CONSTRAINT "AppointmentService_active_price_positive_chk"
CHECK (
    "membershipStatus" <> 'ACTIVE'
    OR "priceSnapshot" > 0
),

ADD CONSTRAINT "AppointmentService_active_duration_positive_chk"
CHECK (
    "membershipStatus" <> 'ACTIVE'
    OR "durationMinutesSnapshot" > 0
),

ADD CONSTRAINT "AppointmentService_active_buffer_nonnegative_chk"
CHECK (
    "membershipStatus" <> 'ACTIVE'
    OR "bufferMinutesSnapshot" >= 0
),

ADD CONSTRAINT "AppointmentService_active_commission_rate_range_chk"
CHECK (
    "membershipStatus" <> 'ACTIVE'
    OR (
        "commissionRateSnapshot" >= 0
        AND "commissionRateSnapshot" <= 1
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "StaffService_staffId_isActive_idx" ON "StaffService"("staffId", "isActive");

-- CreateIndex
CREATE INDEX "StaffService_serviceId_isActive_idx" ON "StaffService"("serviceId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "StaffService_staffId_serviceId_key" ON "StaffService"("staffId", "serviceId");

-- CreateIndex
CREATE INDEX "SalonClosure_startsAt_endsAt_idx" ON "SalonClosure"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "StaffSchedule_staffId_dayOfWeek_idx" ON "StaffSchedule"("staffId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "StaffUnavailability_staffId_startsAt_endsAt_idx" ON "StaffUnavailability"("staffId", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "BookingPolicyVersion_version_key" ON "BookingPolicyVersion"("version");

-- CreateIndex
CREATE UNIQUE INDEX "BookingPolicyVersion_effectiveFrom_key" ON "BookingPolicyVersion"("effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_bookingCode_key" ON "Appointment"("bookingCode");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_recoveryOfAppointmentId_key" ON "Appointment"("recoveryOfAppointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_carriedAppointmentFeePaymentId_key" ON "Appointment"("carriedAppointmentFeePaymentId");

-- CreateIndex
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");

-- CreateIndex
CREATE INDEX "Appointment_customerId_idx" ON "Appointment"("customerId");

-- CreateIndex
CREATE INDEX "Appointment_startAt_idx" ON "Appointment"("startAt");

-- CreateIndex
CREATE INDEX "Appointment_holdExpiresAt_idx" ON "Appointment"("holdExpiresAt");

-- CreateIndex
CREATE INDEX "Appointment_bookingPolicyVersionId_idx" ON "Appointment"("bookingPolicyVersionId");

-- CreateIndex
CREATE INDEX "AppointmentService_appointmentId_membershipStatus_idx" ON "AppointmentService"("appointmentId", "membershipStatus");

-- CreateIndex
CREATE INDEX "AppointmentService_staffId_membershipStatus_scheduledStartA_idx" ON "AppointmentService"("staffId", "membershipStatus", "scheduledStartAt");

-- CreateIndex
CREATE INDEX "AppointmentService_staffId_membershipStatus_reservedUntilAt_idx" ON "AppointmentService"("staffId", "membershipStatus", "reservedUntilAt");

-- CreateIndex
CREATE INDEX "AppointmentRescheduleHistory_appointmentId_createdAt_idx" ON "AppointmentRescheduleHistory"("appointmentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentRescheduleHistory_appointmentId_rescheduleNumber_key" ON "AppointmentRescheduleHistory"("appointmentId", "rescheduleNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_appointmentId_type_idx" ON "Payment"("appointmentId", "type");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_reconciliationStatus_idx" ON "Payment"("reconciliationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_provider_externalReference_key" ON "Payment"("provider", "externalReference");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_paymentId_key" ON "Receipt"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_receiptNumber_key" ON "Receipt"("receiptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionRecord_appointmentServiceId_key" ON "CommissionRecord"("appointmentServiceId");

-- CreateIndex
CREATE INDEX "CommissionRecord_staffId_finalizedAt_idx" ON "CommissionRecord"("staffId", "finalizedAt");

-- CreateIndex
CREATE INDEX "CommissionRecord_appointmentId_idx" ON "CommissionRecord"("appointmentId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "NotificationQueue_status_scheduledAt_idx" ON "NotificationQueue"("status", "scheduledAt");

-- ============================================================
-- Custom PostgreSQL partial unique indexes
-- Required by DATABASE_MODEL.md
-- ============================================================

-- Only ACTIVE services in the same appointment must have
-- unique sequence numbers.
CREATE UNIQUE INDEX "AppointmentService_active_sequence_unique"
ON "AppointmentService" ("appointmentId", "sequenceNo")
WHERE "membershipStatus" = 'ACTIVE';


-- At most one successful APPOINTMENT_FEE payment may be
-- recognized as satisfying an appointment's booking-fee obligation.
CREATE UNIQUE INDEX "Payment_appointment_fee_obligation_unique"
ON "Payment" ("appointmentId")
WHERE
    "type" = 'APPOINTMENT_FEE'
    AND "status" = 'SUCCEEDED'
    AND "satisfiesObligation" = TRUE;


-- The MVP permits only one successful SERVICE_PAYMENT
-- per appointment.
CREATE UNIQUE INDEX "Payment_successful_service_payment_unique"
ON "Payment" ("appointmentId")
WHERE
    "type" = 'SERVICE_PAYMENT'
    AND "status" = 'SUCCEEDED';

-- AddForeignKey
ALTER TABLE "StaffService" ADD CONSTRAINT "StaffService_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffService" ADD CONSTRAINT "StaffService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalonClosure" ADD CONSTRAINT "SalonClosure_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSchedule" ADD CONSTRAINT "StaffSchedule_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffUnavailability" ADD CONSTRAINT "StaffUnavailability_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffUnavailability" ADD CONSTRAINT "StaffUnavailability_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingPolicyVersion" ADD CONSTRAINT "BookingPolicyVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_bookingPolicyVersionId_fkey" FOREIGN KEY ("bookingPolicyVersionId") REFERENCES "BookingPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_recoveryOfAppointmentId_fkey" FOREIGN KEY ("recoveryOfAppointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_carriedAppointmentFeePaymentId_fkey" FOREIGN KEY ("carriedAppointmentFeePaymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentService" ADD CONSTRAINT "AppointmentService_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentService" ADD CONSTRAINT "AppointmentService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentService" ADD CONSTRAINT "AppointmentService_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentService" ADD CONSTRAINT "AppointmentService_outcomeFinalizedByUserId_fkey" FOREIGN KEY ("outcomeFinalizedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentRescheduleHistory" ADD CONSTRAINT "AppointmentRescheduleHistory_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentRescheduleHistory" ADD CONSTRAINT "AppointmentRescheduleHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentRescheduleHistory" ADD CONSTRAINT "AppointmentRescheduleHistory_actorCustomerId_fkey" FOREIGN KEY ("actorCustomerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reconciledByUserId_fkey" FOREIGN KEY ("reconciledByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRecord" ADD CONSTRAINT "CommissionRecord_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRecord" ADD CONSTRAINT "CommissionRecord_appointmentServiceId_fkey" FOREIGN KEY ("appointmentServiceId") REFERENCES "AppointmentService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRecord" ADD CONSTRAINT "CommissionRecord_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRecord" ADD CONSTRAINT "CommissionRecord_sourcePaymentId_fkey" FOREIGN KEY ("sourcePaymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionRecord" ADD CONSTRAINT "CommissionRecord_finalizedByUserId_fkey" FOREIGN KEY ("finalizedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorCustomerId_fkey" FOREIGN KEY ("actorCustomerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationQueue" ADD CONSTRAINT "NotificationQueue_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationQueue" ADD CONSTRAINT "NotificationQueue_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
