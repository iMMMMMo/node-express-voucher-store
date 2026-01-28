const prisma = require("../prisma/prismaClient");

const ProductAttributeModel = {
  findAllWithValuesCount: async () => {
    return await prisma.productAttribute.findMany({
      orderBy: { id: "asc" },
      include: { _count: { select: { values: true } } },
    });
  },

  findAllForSelect: async () => {
    return await prisma.productAttribute.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
  },

  findByIdWithValuesCount: async (id) => {
    if (!id) return null;

    return await prisma.productAttribute.findUnique({
      where: { id },
      include: { _count: { select: { values: true } } },
    });
  },

  create: async ({ name }) => {
    return await prisma.productAttribute.create({
      data: { name },
      select: { id: true, name: true },
    });
  },

  update: async (id, { name }) => {
    return await prisma.productAttribute.update({
      where: { id },
      data: { name },
      select: { id: true, name: true },
    });
  },

  delete: async (id) => {
    return await prisma.productAttribute.delete({
      where: { id },
      select: { id: true },
    });
  },
};

module.exports = ProductAttributeModel;
