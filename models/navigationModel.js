const prisma = require("../prisma/prismaClient");

const NavigationModel = {
  findAllForUser: async (userId) => {
    if (!userId) return [];

    return await prisma.navigation.findMany({
      where: { userId },
      select: {
        id: true,
        userId: true,
        parentId: true,
        title: true,
        url: true,
        order: true,
        isActive: true,
        createdAt: true,
        parent: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: [{ order: "asc" }, { id: "asc" }],
    });
  },
};

module.exports = NavigationModel;
