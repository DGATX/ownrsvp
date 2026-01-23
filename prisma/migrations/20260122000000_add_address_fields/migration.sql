-- Replace single "location" field with structured address components
-- This migration adds new address columns and migrates existing location data

-- SQLite requires table recreation to remove columns
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- Create new Event table with updated schema
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "locationName" TEXT,
    "streetAddress1" TEXT,
    "streetAddress2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "date" DATETIME NOT NULL,
    "endDate" DATETIME,
    "rsvpDeadline" DATETIME,
    "timezone" TEXT,
    "coverImage" TEXT,
    "photoAlbumUrl" TEXT,
    "reminderSchedule" TEXT,
    "maxGuestsPerInvitee" INTEGER,
    "replyTo" TEXT,
    "hostId" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Event_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Copy data from old table, migrating "location" to "locationName"
INSERT INTO "new_Event" (
    "id", "slug", "title", "description", "locationName",
    "date", "endDate", "rsvpDeadline", "timezone", "coverImage",
    "photoAlbumUrl", "reminderSchedule", "maxGuestsPerInvitee", "replyTo",
    "hostId", "isPublic", "createdAt", "updatedAt"
)
SELECT
    "id", "slug", "title", "description", "location",
    "date", "endDate", "rsvpDeadline", "timezone", "coverImage",
    "photoAlbumUrl", "reminderSchedule", "maxGuestsPerInvitee", "replyTo",
    "hostId", "isPublic", "createdAt", "updatedAt"
FROM "Event";

-- Drop old table and rename new one
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";

-- Recreate indexes
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");
CREATE INDEX "Event_hostId_idx" ON "Event"("hostId");
CREATE INDEX "Event_date_idx" ON "Event"("date");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
