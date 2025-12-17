const prisma = require("../prisma/prismaClient");

const PageModel = {
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
