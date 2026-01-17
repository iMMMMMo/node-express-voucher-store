const prisma = require("../prisma/prismaClient");

const BannerModel = {
  findAllByUserId: async (userId) => {
    if (!userId) return [];

    return await prisma.banner.findMany({
      where: { userId },
      select: {
        id: true,
        userId: true,
        imagePath: true,
        caption: true,
        content: true,
        button: true,
        link: true,
        order: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: [{ order: "asc" }, { id: "asc" }],
    });
  },

  findByIdForUser: async (id, userId) => {
    if (!id || !userId) return null;

    return await prisma.banner.findFirst({
      where: { id, userId },
      select: {
        id: true,
        userId: true,
        imagePath: true,
        caption: true,
        content: true,
        button: true,
        link: true,
        order: true,
        isActive: true,
        createdAt: true,
      },
    });
  },

  create: async ({ userId, imagePath = null, caption = null, content = null, button = null, link = null, order = 0, isActive = true }) => {
    return await prisma.banner.create({
      data: {
        userId,
        imagePath,
        caption,
        content,
        button,
        link,
        order,
        isActive,
      },
      select: {
        id: true,
        userId: true,
        imagePath: true,
        caption: true,
        content: true,
        button: true,
        link: true,
        order: true,
        isActive: true,
        createdAt: true,
      },
    });
  },

  update: async (id, { userId, imagePath = null, caption = null, content = null, button = null, link = null, order = 0, isActive = true }) => {
    return await prisma.banner.update({
      where: { id },
      data: {
        userId,
        imagePath,
        caption,
        content,
        button,
        link,
        order,
        isActive,
      },
      select: {
        id: true,
        userId: true,
        imagePath: true,
        caption: true,
        content: true,
        button: true,
        link: true,
        order: true,
        isActive: true,
        createdAt: true,
      },
    });
  },

  delete: async (id) => {
    return await prisma.banner.delete({
      where: { id },
      select: { id: true },
    });
  },
};

module.exports = BannerModel;
