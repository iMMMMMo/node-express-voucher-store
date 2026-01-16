-- Add redemption metadata to order items
ALTER TABLE "orderitem"
ADD COLUMN "redeem_code" TEXT,
ADD COLUMN "redeemed_at" TIMESTAMP(3);

-- Normalize existing statuses
UPDATE "orderitem"
SET "status" = 'ACTIVE'
WHERE "status" IS NULL OR "status" = 'NEW';

-- Ensure status is always present going forward
ALTER TABLE "orderitem"
ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

ALTER TABLE "orderitem"
ALTER COLUMN "status" SET NOT NULL;
