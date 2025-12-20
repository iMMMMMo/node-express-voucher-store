const prisma = require("../prisma/prismaClient");

const toNumber = (value) => {
    if (value === null || typeof value === 'undefined') return null;
    if (typeof value === 'number') return value;
    const asString = typeof value === 'string' ? value : value.toString();
    const parsed = Number.parseFloat(asString);
    return Number.isFinite(parsed) ? parsed : null;
};

const ProductModel = {
    findAll: async () => {
        const products = await prisma.product.findMany({
            orderBy: { id: 'asc' }
        });

        return products.map(p => ({
            ...p,
            basePrice: toNumber(p.basePrice),
            vat: toNumber(p.vat),
            VAT: toNumber(p.vat),
            finalPrice: (toNumber(p.basePrice) ?? 0) * (1 + ((toNumber(p.vat) ?? 0) / 100))
        }));
    },

    findProduct: async ({ id = null, slug = null }) => {
        const product = await prisma.product.findFirst({
            where: id ? { id } : { slug },
            include: {
                attributes: {
                    include: {
                        attribute: true
                    }
                }
            }
        });

        if (!product) return null;

        const basePrice = toNumber(product.basePrice) ?? 0;
        const vat = toNumber(product.vat) ?? 0;
        const finalPrice = basePrice * (1 + vat / 100);

        const attributes = {};

        product.attributes.forEach(row => {
            const attrName = row.attribute.name;

            if (!attributes[attrName]) {
                attributes[attrName] = [];
            }

            attributes[attrName].push({
                value_id: row.id,
                value: row.value
            });
        });

        return {
            ...product,
            basePrice,
            vat,
            VAT: vat,
            finalPrice,
            attributes
        };
    }
};

module.exports = ProductModel;
