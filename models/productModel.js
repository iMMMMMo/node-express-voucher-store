const prisma = require("../prisma/prismaClient");

const ProductModel = {
    findAll: async () => {
        const products = await prisma.product.findMany({
            orderBy: { id: 'asc' }
        });

        return products.map(p => ({
            ...p,
            finalPrice: Number(p.basePrice) * (1 + Number(p.vat) / 100)
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

        const finalPrice = Number(product.basePrice) * (1 + Number(product.vat) / 100);

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
            finalPrice,
            attributes
        };
    }
};

module.exports = ProductModel;
