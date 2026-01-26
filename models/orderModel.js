const prisma = require("../prisma/prismaClient");

const OrderModel = {
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
};

module.exports = OrderModel;
