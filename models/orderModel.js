const prisma = require("../prisma/prismaClient");
const { Prisma } = require("@prisma/client");

const OrderModel = {
  findAllForAdminWithUserAndItemsCount: async () => {
    return await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, email: true, name: true } },
        _count: { select: { items: true } },
      },
    });
  },

  findByIdForAdminWithDetails: async (id) => {
    if (!id) return null;

    return await prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true, name: true } },
        deliveryAddress: true,
        items: {
          include: { product: { select: { id: true, name: true, slug: true } } },
          orderBy: { id: "asc" },
        },
      },
    });
  },

  findAllForUserWithItemsCount: async (userId) => {
    if (!userId) return [];

    return await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { items: true } },
      },
    });
  },

  findByIdForUserWithDetails: async (id, userId) => {
    if (!id || !userId) return null;

    return await prisma.order.findFirst({
      where: { id, userId },
      include: {
        user: { select: { email: true, name: true } },
        deliveryAddress: true,
        items: {
          include: { product: { select: { name: true, slug: true } } },
          orderBy: { id: "asc" },
        },
      },
    });
  },

  placeCheckoutOrder: async ({
    userId,
    paymentMethod,
    deliveryMethod,
    deliveryPriceNumber,
    paymentPriceNumber,
    deliveryAddressId,
    newDeliveryAddress,
    pricedItems,
  }) => {
    if (!userId) {
      const err = new Error("Missing userId");
      err.code = "MISSING_USER";
      throw err;
    }

    const items = Array.isArray(pricedItems) ? pricedItems : [];
    const itemsTotal = items.reduce((sum, it) => sum + (Number(it?.lineFinal) || 0), 0);
    const deliveryPrice = Number(deliveryPriceNumber) || 0;
    const paymentPrice = Number(paymentPriceNumber) || 0;
    const total = itemsTotal + deliveryPrice + paymentPrice;

    const order = await prisma.$transaction(async (tx) => {
      let resolvedDeliveryAddressId = deliveryAddressId ?? null;

      if (deliveryMethod === "COURIER" && !resolvedDeliveryAddressId && newDeliveryAddress) {
        const created = await tx.userAddress.create({
          data: {
            userId,
            street: newDeliveryAddress.street,
            city: newDeliveryAddress.city,
            postalCode: newDeliveryAddress.postalCode,
            country: newDeliveryAddress.country,
            type: "delivery",
            isDefault: false,
          },
          select: { id: true },
        });
        resolvedDeliveryAddressId = created.id;
      }

      const createdOrder = await tx.order.create({
        data: {
          userId,
          deliveryAddressId: deliveryMethod === "COURIER" ? resolvedDeliveryAddressId : null,
          totalPrice: new Prisma.Decimal(total.toFixed(2)),
          status: "PLACED",
          paymentMethod,
          paymentPrice: new Prisma.Decimal(paymentPrice.toFixed(2)),
          paymentStatus: "UNPAID",
          deliveryMethod,
          deliveryPrice: new Prisma.Decimal(deliveryPrice.toFixed(2)),
          items: {
            create: items.flatMap((it) => {
              const qty = Math.max(1, Number.parseInt(it.qty, 10) || 1);
              const perUnit = [];

              for (let i = 0; i < qty; i++) {
                const rec = Array.isArray(it.recipients) ? it.recipients[i] : null;
                perUnit.push({
                  productId: it.productId,
                  quantity: 1,
                  unitPrice: new Prisma.Decimal(Number(it.unitBase || 0).toFixed(2)),
                  vat: new Prisma.Decimal(Number(it.vat || 0).toFixed(2)),
                  finalPrice: new Prisma.Decimal(Number(it.unitFinal || 0).toFixed(2)),
                  selectedAttributes:
                    it.selectedAttributes && it.selectedAttributes.length ? it.selectedAttributes : null,
                  recipientName: rec?.recipientName ?? null,
                  dedication: rec?.dedication ?? null,
                  status: "ACTIVE",
                });
              }

              return perUnit;
            }),
          },
        },
        select: { id: true },
      });

      return createdOrder;
    });

    return order;
  },
};

module.exports = OrderModel;
