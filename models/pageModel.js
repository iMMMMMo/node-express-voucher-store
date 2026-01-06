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
