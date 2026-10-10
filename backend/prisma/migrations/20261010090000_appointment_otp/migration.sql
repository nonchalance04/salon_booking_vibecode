CREATE TABLE "AppointmentOtpChallenge" (
 "id" UUID PRIMARY KEY, "appointmentId" UUID, "identityKey" TEXT NOT NULL,
 "codeHash" TEXT NOT NULL, "attempts" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expiresAt" TIMESTAMPTZ(3) NOT NULL, "consumedAt" TIMESTAMPTZ(3),
 CONSTRAINT "AppointmentOtpChallenge_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AppointmentOtpChallenge_identityKey_createdAt_idx" ON "AppointmentOtpChallenge"("identityKey", "createdAt");
CREATE INDEX "AppointmentOtpChallenge_expiresAt_idx" ON "AppointmentOtpChallenge"("expiresAt");
CREATE TABLE "AppointmentGuestSession" (
 "tokenHash" TEXT PRIMARY KEY, "appointmentId" UUID NOT NULL, "expiresAt" TIMESTAMPTZ(3) NOT NULL,
 CONSTRAINT "AppointmentGuestSession_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AppointmentGuestSession_expiresAt_idx" ON "AppointmentGuestSession"("expiresAt");
CREATE TABLE "AppointmentOtpRate" ("key" TEXT PRIMARY KEY, "count" INTEGER NOT NULL, "expiresAt" TIMESTAMPTZ(3) NOT NULL);
CREATE INDEX "AppointmentOtpRate_expiresAt_idx" ON "AppointmentOtpRate"("expiresAt");
