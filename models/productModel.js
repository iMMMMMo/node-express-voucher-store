const prisma = require("../prisma/prismaClient");
const { toNumber } = require("../utils/number");
const { Prisma } = require("@prisma/client");

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

    findByIdWithAdminCounts: async (id) => {
        if (!id) return null;

        return await prisma.product.findUnique({
            where: { id },
            include: { _count: { select: { attributes: true, orderItems: true } } }
        });
    },

    findByIdWithAttributesForAdmin: async (id) => {
        if (!id) return null;

        return await prisma.product.findUnique({
            where: { id },
            include: {
                attributes: {
                    include: { attribute: true },
                    orderBy: [{ attributeId: 'asc' }, { id: 'asc' }],
                },
            },
        });
    },

    create: async ({ name, slug, description = null, basePrice = 0, vat = 0, imagePath = null }) => {
        return await prisma.product.create({
            data: {
                name,
                slug,
                description,
                basePrice: new Prisma.Decimal(Number(basePrice || 0).toFixed(2)),
                vat: new Prisma.Decimal(Number(vat || 0).toFixed(2)),
                imagePath,
            },
            select: { id: true }
        });
    },

    update: async (id, { name, slug, description = null, basePrice = 0, vat = 0, imagePath = null }) => {
        return await prisma.product.update({
            where: { id },
            data: {
                name,
                slug,
                description,
                basePrice: new Prisma.Decimal(Number(basePrice || 0).toFixed(2)),
                vat: new Prisma.Decimal(Number(vat || 0).toFixed(2)),
                imagePath,
            },
            select: { id: true }
        });
    },

    delete: async (id) => {
        return await prisma.product.delete({
            where: { id },
            select: { id: true }
        });
    },

    findProduct: async ({ id = null, slug = null }) => {
        const product = await prisma.product.findFirst({
            where: id ? { id } : { slug },
            include: {
                attributes: {
                    include: {
                        attribute: true
                    },
                    orderBy: [
                        { attributeId: 'asc' },
                        { priceDelta: 'asc' },
                        { id: 'asc' }
                    ]
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
                value: row.value,
                priceDelta: toNumber(row.priceDelta) ?? 0
            });
        });

        Object.keys(attributes).forEach((attrName) => {
            attributes[attrName].sort((a, b) => {
                const da = Number(a.priceDelta) || 0;
                const db = Number(b.priceDelta) || 0;
                if (da !== db) return da - db;
                const va = (a.value ?? '').toString();
                const vb = (b.value ?? '').toString();
                const vc = va.localeCompare(vb, 'pl');
                if (vc !== 0) return vc;
                return (Number(a.value_id) || 0) - (Number(b.value_id) || 0);
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
