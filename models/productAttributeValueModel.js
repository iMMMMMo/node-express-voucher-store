const prisma = require("../prisma/prismaClient");
const { Prisma } = require("@prisma/client");

const ProductAttributeValueModel = {
  applyChangesForProduct: async (productId, { deletes = [], updates = [], creates = [] } = {}) => {
    const ops = [];

    for (const id of Array.isArray(deletes) ? deletes : []) {
      ops.push(
        prisma.productAttributeValue.delete({
          where: { id },
        }),
      );
    }

    for (const row of Array.isArray(updates) ? updates : []) {
      ops.push(
        prisma.productAttributeValue.update({
          where: { id: row.id },
          data: {
            attributeId: row.attributeId,
            value: row.value,
            priceDelta: new Prisma.Decimal(Number(row.priceDelta || 0).toFixed(2)),
          },
        }),
      );
    }

    for (const row of Array.isArray(creates) ? creates : []) {
      ops.push(
        prisma.productAttributeValue.create({
          data: {
            productId,
            attributeId: row.attributeId,
            value: row.value,
            priceDelta: new Prisma.Decimal(Number(row.priceDelta || 0).toFixed(2)),
          },
        }),
      );
    }

    if (!ops.length) return { ok: true, count: 0 };

    await prisma.$transaction(ops);
    return { ok: true, count: ops.length };
  },
};

module.exports = ProductAttributeValueModel;
