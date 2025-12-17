-- CreateTable
CREATE TABLE "users" (
    "user_id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "useraddress" (
    "address_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "useraddress_pkey" PRIMARY KEY ("address_id")
);

-- CreateTable
CREATE TABLE "navigation" (
    "nav_id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "parent_id" INTEGER,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "navigation_pkey" PRIMARY KEY ("nav_id")
);

-- CreateTable
CREATE TABLE "page" (
    "page_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "content" TEXT,
    "imagePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_pkey" PRIMARY KEY ("page_id")
);

-- CreateTable
CREATE TABLE "settings" (
    "settings_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("settings_id")
);

-- CreateTable
CREATE TABLE "banner" (
    "banner_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "imagePath" TEXT,
    "caption" TEXT,
    "content" TEXT,
    "button" TEXT,
    "link" TEXT,
    "order" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banner_pkey" PRIMARY KEY ("banner_id")
);

-- CreateTable
CREATE TABLE "order" (
    "order_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "status" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "paymentPrice" DECIMAL(10,2),
    "paymentStatus" TEXT,
    "deliveryMethod" TEXT,
    "deliveryPrice" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_pkey" PRIMARY KEY ("order_id")
);

-- CreateTable
CREATE TABLE "orderitem" (
    "order_item_id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "product_id" INTEGER NOT NULL,
    "recipientName" TEXT,
    "dedication" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "VAT" DECIMAL(4,2),
    "finalPrice" DECIMAL(10,2) NOT NULL,
    "selectedAttributes" JSONB,
    "status" TEXT,

    CONSTRAINT "orderitem_pkey" PRIMARY KEY ("order_item_id")
);

-- CreateTable
CREATE TABLE "product" (
    "product_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "basePrice" DECIMAL(10,2) NOT NULL,
    "VAT" DECIMAL(4,2) NOT NULL,
    "imagePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_pkey" PRIMARY KEY ("product_id")
);

-- CreateTable
CREATE TABLE "productattribute" (
    "attribute_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "productattribute_pkey" PRIMARY KEY ("attribute_id")
);

-- CreateTable
CREATE TABLE "productattributevalue" (
    "value_id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "attribute_id" INTEGER NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "productattributevalue_pkey" PRIMARY KEY ("value_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "page_url_key" ON "page"("url");

-- CreateIndex
CREATE UNIQUE INDEX "product_slug_key" ON "product"("slug");

-- AddForeignKey
ALTER TABLE "useraddress" ADD CONSTRAINT "useraddress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "navigation" ADD CONSTRAINT "navigation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "navigation" ADD CONSTRAINT "navigation_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "navigation"("nav_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page" ADD CONSTRAINT "page_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banner" ADD CONSTRAINT "banner_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orderitem" ADD CONSTRAINT "orderitem_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("order_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orderitem" ADD CONSTRAINT "orderitem_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productattributevalue" ADD CONSTRAINT "productattributevalue_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productattributevalue" ADD CONSTRAINT "productattributevalue_attribute_id_fkey" FOREIGN KEY ("attribute_id") REFERENCES "productattribute"("attribute_id") ON DELETE RESTRICT ON UPDATE CASCADE;
