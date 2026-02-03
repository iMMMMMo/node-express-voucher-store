const prisma = require("../prisma/prismaClient");

const ProductPricingModel = {
  findProductBySlugForPricing: async (slug) => {
    if (!slug) return null;

    return await prisma.product.findFirst({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        imagePath: true,
        basePrice: true,
        vat: true,
      },
    });
  },

  findProductsBySlugsForCart: async (slugs) => {
    const unique = Array.from(new Set((slugs || []).filter(Boolean)));
    if (!unique.length) return [];

    return await prisma.product.findMany({
      where: { slug: { in: unique } },
      select: { id: true, slug: true, basePrice: true, vat: true, imagePath: true, name: true },
    });
  },

  findAttributeValuesForProductWithAttribute: async ({ productId, ids }) => {
    const unique = Array.from(
      new Set((ids || []).filter((x) => Number.isFinite(Number(x)) && Number(x) > 0)),
    );
    if (!productId || !unique.length) return [];

    return await prisma.productAttributeValue.findMany({
      where: {
        id: { in: unique },
        productId,
      },
      include: {
        attribute: true,
      },
      orderBy: { id: "asc" },
    });
  },

  findAttributeValuesByIdsWithAttribute: async (ids) => {
    const unique = Array.from(
      new Set((ids || []).filter((x) => Number.isFinite(Number(x)) && Number(x) > 0)),
    );
    if (!unique.length) return [];

    return await prisma.productAttributeValue.findMany({
      where: { id: { in: unique } },
      include: { attribute: true },
    });
  },
};

module.exports = ProductPricingModel;
