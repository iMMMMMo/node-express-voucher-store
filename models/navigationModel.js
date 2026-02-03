const prisma = require("../prisma/prismaClient");

const NavigationModel = {
  findAllFlatForUser: async (userId) => {
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
      },
      orderBy: [{ order: "asc" }, { id: "asc" }],
    });
  },

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

  findAllForUserAsParents: async (userId, { excludeId = null, excludeIds = [] } = {}) => {
    if (!userId) return [];

    const exclusions = new Set([
      ...(excludeId ? [excludeId] : []),
      ...(Array.isArray(excludeIds) ? excludeIds.filter(Boolean) : []),
    ]);

    return await prisma.navigation.findMany({
      where: {
        userId,
        ...(exclusions.size ? { id: { notIn: Array.from(exclusions) } } : {}),
      },
      select: {
        id: true,
        parentId: true,
        title: true,
        order: true,
      },
      orderBy: [{ order: "asc" }, { id: "asc" }],
    });
  },

  findByIdForUser: async (id, userId) => {
    if (!id || !userId) return null;

    return await prisma.navigation.findFirst({
      where: { id, userId },
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
        _count: {
          select: {
            children: true,
          },
        },
      },
    });
  },

  create: async ({ userId, parentId = null, title, url, order = 0, isActive = true }) => {
    if (!userId) throw new Error("userId is required");

    return await prisma.navigation.create({
      data: {
        userId,
        parentId,
        title,
        url,
        order,
        isActive,
      },
      select: {
        id: true,
        userId: true,
        parentId: true,
        title: true,
        url: true,
        order: true,
        isActive: true,
        createdAt: true,
      },
    });
  },

  updateForUser: async (
    id,
    userId,
    { parentId = null, title, url, order = 0, isActive = true },
  ) => {
    if (!id || !userId) return { ok: false };

    const result = await prisma.navigation.updateMany({
      where: { id, userId },
      data: {
        parentId,
        title,
        url,
        order,
        isActive,
      },
    });

    return { ok: result.count > 0 };
  },

  deleteForUser: async (id, userId) => {
    if (!id || !userId) return { ok: false };

    const result = await prisma.navigation.deleteMany({
      where: { id, userId },
    });

    return { ok: result.count > 0 };
  },
};

module.exports = NavigationModel;
