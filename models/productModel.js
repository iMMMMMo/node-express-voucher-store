const prisma = require("../prisma/prismaClient");

const toNumber = (value) => {
    if (value === null || typeof value === 'undefined') return null;
    if (typeof value === 'number') return value;
    const asString = typeof value === 'string' ? value : value.toString();
    const parsed = Number.parseFloat(asString);
    return Number.isFinite(parsed) ? parsed : null;
};

const normalizeSelectedAttributeValueIds = (value) => {
    const arr = Array.isArray(value) ? value : (value ? [value] : []);
    const parsed = arr
        .map((v) => Number.parseInt(v, 10))
        .filter((v) => Number.isFinite(v) && v > 0);
    return Array.from(new Set(parsed)).sort((a, b) => a - b);
};

const buildCartItemKey = ({ slug, selectedAttributeValueIds }) => {
    const ids = normalizeSelectedAttributeValueIds(selectedAttributeValueIds);
    if (!ids.length) return slug;
    return `${slug}--${ids.join('-')}`;
};

const getSelectedAttributeRowsForProduct = async ({ productId, selectedAttributeValueIds }) => {
    const ids = normalizeSelectedAttributeValueIds(selectedAttributeValueIds);
    if (!ids.length) return [];

    const rows = await prisma.productAttributeValue.findMany({
        where: {
            id: { in: ids },
            productId,
        },
        include: {
            attribute: true,
        },
        orderBy: { id: 'asc' }
    });

    return rows;
};

const ProductModel = {
    buildCartItemKey,
    normalizeSelectedAttributeValueIds,

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
    },

    getPricingForProductSelection: async ({ slug, selectedAttributeValueIds }) => {
        const ids = normalizeSelectedAttributeValueIds(selectedAttributeValueIds);

        const product = await prisma.product.findFirst({
            where: { slug },
            select: { id: true, slug: true, name: true, imagePath: true, basePrice: true, vat: true }
        });

        if (!product) return null;

        const basePrice = toNumber(product.basePrice) ?? 0;
        const vat = toNumber(product.vat) ?? 0;

        const selectedRows = await getSelectedAttributeRowsForProduct({
            productId: product.id,
            selectedAttributeValueIds: ids,
        });

        const selectedAttributes = selectedRows.map((row) => ({
            attributeId: row.attributeId,
            attributeName: row.attribute?.name,
            valueId: row.id,
            value: row.value,
            priceDelta: toNumber(row.priceDelta) ?? 0,
        }));

        const vatFactor = 1 + vat / 100;
        const deltaGrossSum = selectedAttributes.reduce((sum, row) => sum + (Number(row.priceDelta) || 0), 0);
        const deltaNetSum = vatFactor > 0 ? (deltaGrossSum / vatFactor) : deltaGrossSum;
        const unitBase = basePrice + deltaNetSum;
        const unitFinal = unitBase * vatFactor;

        return {
            product: {
                ...product,
                basePrice,
                vat,
            },
            selectedAttributeValueIds: ids,
            selectedAttributes,
            unitBase,
            unitFinal,
            cartItemKey: buildCartItemKey({ slug, selectedAttributeValueIds: ids }),
        };
    }
};

module.exports = ProductModel;
