-- Add optional delivery address reference to orders
ALTER TABLE "order"
ADD COLUMN "delivery_address_id" INTEGER;

ALTER TABLE "order"
ADD CONSTRAINT "order_delivery_address_id_fkey"
FOREIGN KEY ("delivery_address_id") REFERENCES "useraddress"("address_id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "order_delivery_address_id_idx" ON "order"("delivery_address_id");
