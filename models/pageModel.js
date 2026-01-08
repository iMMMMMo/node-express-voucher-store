const prisma = require("../prisma/prismaClient");

const PageModel = {
  findAll: async () => {
    return await prisma.page.findMany({
      select: {
        id: true,
        title: true,
        url: true,
        content: true,
        imagePath: true,
        createdAt: true,
        userId: true,
      },
      orderBy: { createdAt: "desc" },
    });
  },

  findAllByUserId: async (userId) => {
    if (!userId) return [];

    return await prisma.page.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        url: true,
        content: true,
        imagePath: true,
        createdAt: true,
        userId: true,
      },
      orderBy: { id: "asc" },
    });
  },

  findById: async (id) => {
    if (!id) return null;

    return await prisma.page.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        title: true,
        url: true,
        content: true,
        imagePath: true,
        createdAt: true,
      },
    });
  },

  findByIdForUser: async (id, userId) => {
    if (!id || !userId) return null;

    return await prisma.page.findFirst({
      where: { id, userId },
      select: {
        id: true,
        userId: true,
        title: true,
        url: true,
        content: true,
        imagePath: true,
        createdAt: true,
      },
    });
  },

  create: async ({ userId, title, url, content = null, imagePath = null }) => {
    return await prisma.page.create({
      data: {
        userId,
        title,
        url,
        content,
        imagePath,
      },
      select: {
        id: true,
        userId: true,
        title: true,
        url: true,
        content: true,
        imagePath: true,
        createdAt: true,
      },
    });
  },

  update: async (id, { userId, title, url, content = null, imagePath = null }) => {
    return await prisma.page.update({
      where: { id },
      data: {
        userId,
        title,
        url,
        content,
        imagePath,
      },
      select: {
        id: true,
        userId: true,
        title: true,
        url: true,
        content: true,
        imagePath: true,
        createdAt: true,
      },
    });
  },

  delete: async (id) => {
    return await prisma.page.delete({
      where: { id },
      select: { id: true },
    });
  },

  findActiveByUrl: async (url) => {
    if (!url) return null;

    return await prisma.page.findFirst({
      where: {
        url,
      },
      select: {
        title: true,
        url: true,
        content: true,
        imagePath: true,
      },
    });
  },
};

module.exports = PageModel;
