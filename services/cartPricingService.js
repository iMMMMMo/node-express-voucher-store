const { toNumber } = require('../utils/number');
const ProductPricingModel = require('../models/productPricingModel');

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

    return ProductPricingModel.findAttributeValuesForProductWithAttribute({
        productId,
        ids,
    });
};

const getPricingForProductSelection = async ({ slug, selectedAttributeValueIds }) => {
    const ids = normalizeSelectedAttributeValueIds(selectedAttributeValueIds);

    const product = await ProductPricingModel.findProductBySlugForPricing(slug);

    if (!product) return null;

    const basePrice = toNumber(product.basePrice) ?? 0;
    const vat = toNumber(product.vat) ?? 0;
    const vatFactor = 1 + vat / 100;

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
};

const repairCartPrices = async (cart) => {
    if (!Array.isArray(cart) || !cart.length) return cart;

    const slugs = cart.map((i) => i.slug).filter(Boolean);
    const products = await ProductPricingModel.findProductsBySlugsForCart(slugs);
    const bySlug = new Map(products.map((p) => [p.slug, p]));

    const allSelectedIds = cart
        .flatMap((item) => normalizeSelectedAttributeValueIds(item.selectedAttributeValueIds))
        .filter(Boolean);
    const uniqueSelectedIds = Array.from(new Set(allSelectedIds));

    const selectedRows = uniqueSelectedIds.length
        ? await ProductPricingModel.findAttributeValuesByIdsWithAttribute(uniqueSelectedIds)
        : [];
    const selectedById = new Map(selectedRows.map((r) => [r.id, r]));

    cart.forEach((item) => {
        const p = bySlug.get(item.slug);
        if (!p) return;

        const base = toNumber(p.basePrice) ?? 0;
        const vat = toNumber(p.vat) ?? 0;
        const vatFactor = 1 + vat / 100;

        const ids = normalizeSelectedAttributeValueIds(item.selectedAttributeValueIds);
        item.selectedAttributeValueIds = ids;
        if (!item.key) {
            item.key = buildCartItemKey({ slug: item.slug, selectedAttributeValueIds: ids });
        }

        const selectedAttributes = ids
            .map((id) => {
                const row = selectedById.get(id);
                if (!row || row.productId !== p.id) return null;
                return {
                    attributeId: row.attributeId,
                    attributeName: row.attribute?.name,
                    valueId: row.id,
                    value: row.value,
                    priceDelta: toNumber(row.priceDelta) ?? 0,
                };
            })
            .filter(Boolean);

        item.selectedAttributes = selectedAttributes.length ? selectedAttributes : null;

        const deltaGrossSum = selectedAttributes.reduce((sum, row) => sum + (Number(row.priceDelta) || 0), 0);
        const deltaNetSum = vatFactor > 0 ? (deltaGrossSum / vatFactor) : deltaGrossSum;
        const unitBase = base + deltaNetSum;
        const unitFinal = unitBase * vatFactor;

        item.price = Number.isFinite(unitFinal) ? unitFinal : 0;
        if (!item.name) item.name = p.name;
        if (!item.imagePath) item.imagePath = p.imagePath || '/images/products/product-default.jpg';
    });

    return cart;
};

const priceCartForOrder = async (cart) => {
    if (!Array.isArray(cart) || !cart.length) return { ok: true, items: [] };

    const slugs = cart.map((i) => i.slug).filter(Boolean);
    const products = await ProductPricingModel.findProductsBySlugsForCart(slugs);
    const bySlug = new Map(products.map((p) => [p.slug, p]));

    const allSelectedIds = cart
        .flatMap((item) => normalizeSelectedAttributeValueIds(item.selectedAttributeValueIds))
        .filter(Boolean);
    const uniqueSelectedIds = Array.from(new Set(allSelectedIds));

    const selectedRows = uniqueSelectedIds.length
        ? await ProductPricingModel.findAttributeValuesByIdsWithAttribute(uniqueSelectedIds)
        : [];
    const selectedById = new Map(selectedRows.map((r) => [r.id, r]));

    for (const item of cart) {
        if (!bySlug.has(item.slug)) {
            return { ok: false, error: `Product "${item.slug}" is no longer available.` };
        }
    }

    const pricedItems = cart.map((item) => {
        const p = bySlug.get(item.slug);
        const qty = Math.max(1, Number.parseInt(item.quantity, 10) || 1);

        const base = toNumber(p.basePrice) ?? 0;
        const vat = toNumber(p.vat) ?? 0;
        const vatFactor = 1 + vat / 100;

        const ids = normalizeSelectedAttributeValueIds(item.selectedAttributeValueIds);
        const selectedAttributes = ids
            .map((id) => {
                const row = selectedById.get(id);
                if (!row || row.productId !== p.id) return null;
                return {
                    attributeId: row.attributeId,
                    attributeName: row.attribute?.name,
                    valueId: row.id,
                    value: row.value,
                    priceDelta: toNumber(row.priceDelta) ?? 0,
                };
            })
            .filter(Boolean);

        if (ids.length && selectedAttributes.length !== ids.length) {
            return { error: `Invalid attribute selection for product "${item.slug}".` };
        }

        const deltaGrossSum = selectedAttributes.reduce((sum, row) => sum + (Number(row.priceDelta) || 0), 0);
        const deltaNetSum = vatFactor > 0 ? (deltaGrossSum / vatFactor) : deltaGrossSum;
        const unitBase = base + deltaNetSum;
        const unitFinal = unitBase * vatFactor;
        const lineFinal = unitFinal * qty;

        const recipientsRaw = Array.isArray(item.recipients) ? item.recipients : [];
        const legacyEntry = ((item.recipientName ?? '') || (item.dedication ?? ''))
            ? { recipientName: item.recipientName, dedication: item.dedication }
            : null;
        const effectiveRecipients = recipientsRaw.length ? recipientsRaw : (legacyEntry ? [legacyEntry] : []);

        const recipients = Array.from({ length: qty }).map((_, idx) => {
            const src = effectiveRecipients[idx];
            if (!src) return null;
            const rn = (src.recipientName ?? '').toString().trim().slice(0, 60) || null;
            const dd = (src.dedication ?? '').toString().trim().slice(0, 1000) || null;
            if (!rn && !dd) return null;
            return { recipientName: rn, dedication: dd };
        });

        return {
            productId: p.id,
            qty,
            unitBase,
            unitFinal,
            vat,
            lineFinal,
            selectedAttributes,
            recipients,
        };
    });

    const invalid = pricedItems.find((x) => x && x.error);
    if (invalid) return { ok: false, error: invalid.error };

    return { ok: true, items: pricedItems };
};

module.exports = {
    normalizeSelectedAttributeValueIds,
    buildCartItemKey,
    getPricingForProductSelection,
    repairCartPrices,
    priceCartForOrder,
};
