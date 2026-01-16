-- Remove voucher redemption metadata
ALTER TABLE "orderitem" DROP COLUMN IF EXISTS "redeem_code";
ALTER TABLE "orderitem" DROP COLUMN IF EXISTS "redeemed_at";
