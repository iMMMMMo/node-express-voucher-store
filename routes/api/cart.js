const express = require('express');
const router = express.Router();
const asyncHandler = require('../../utils/asyncHandler');
const { parseIntSafe } = require('../../utils/number');
const { normalizeText } = require('../../utils/text');
const { repairCartPrices, getPricingForProductSelection } = require('../../services/cartPricingService');

const jsonError = (res, status, message) => res.status(status).json({
    ok: false,
    error: { message },
    message,
});

const getCart = (req) => {
    if (!req.session.cart) {
        req.session.cart = [];
    }
    return req.session.cart;
};

const parseQuantity = (value) => {
    return parseIntSafe(value);
};

const normalizeRecipientEntry = (entry) => {
    const recipientName = normalizeText(entry?.recipientName, { maxLen: 60 });
    const dedication = normalizeText(entry?.dedication, { maxLen: 1000 });
    if (!recipientName && !dedication) return null;
    return { recipientName, dedication };
};

const ensureRecipientsArray = (item) => {
    if (Array.isArray(item.recipients)) return item.recipients;
    const migrated = [];
    const legacy = normalizeRecipientEntry({ recipientName: item.recipientName, dedication: item.dedication });
    if (legacy) migrated.push(legacy);
    item.recipients = migrated;
    delete item.recipientName;
    delete item.dedication;
    return item.recipients;
};

router.get('/', asyncHandler(async (req, res) => {
    const cart = getCart(req);
    await repairCartPrices(cart);
    req.session.cart = cart;
    res.json(cart);
}));

router.get('/count', (req, res) => {
    const cart = getCart(req);
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    res.json({ count });
});

router.post('/add', asyncHandler(async (req, res) => {
    const { slug, quantity = 1, selectedAttributeValueIds = [] } = req.body;

    if (!slug) {
        return jsonError(res, 400, 'Product slug is required');
    }

    const pricing = await getPricingForProductSelection({ slug, selectedAttributeValueIds });
    if (!pricing) {
        return jsonError(res, 404, 'Product not found');
    }

    const { product, unitFinal, cartItemKey, selectedAttributeValueIds: normalizedIds } = pricing;

    const qty = parseQuantity(quantity);
    if (qty === null || qty < 1) {
        return jsonError(res, 400, 'Quantity must be an integer of at least 1');
    }

    const cart = getCart(req);
    const existingItemIndex = cart.findIndex(item => (item.key || item.slug) === cartItemKey);

    if (existingItemIndex > -1) {
        cart[existingItemIndex].quantity += qty;
    } else {
        cart.push({
            key: cartItemKey,
            slug: product.slug,
            product_id: product.id,
            name: product.name,
            price: parseFloat(unitFinal),
            imagePath: product.imagePath || '/images/products/product-default.jpg',
            quantity: qty,
            selectedAttributeValueIds: normalizedIds,
            recipients: []
        });
    }

    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    res.json({
        message: 'Product added to cart',
        cart: cart,
        count: totalCount
    });
}));

router.put('/update/:key', asyncHandler((req, res) => {
        const { key } = req.params;
        const { quantity, recipientName, dedication, recipients, recipientIndex } = req.body;

        const hasQuantity = typeof quantity !== 'undefined';
        const hasRecipient = typeof recipientName !== 'undefined';
        const hasDedication = typeof dedication !== 'undefined';
        const hasRecipientsArray = typeof recipients !== 'undefined';
        const hasRecipientIndex = typeof recipientIndex !== 'undefined';
        if (!hasQuantity && !hasRecipient && !hasDedication && !hasRecipientsArray && !hasRecipientIndex) {
            return jsonError(res, 400, 'Nothing to update');
        }

        let qty = null;
        if (hasQuantity) {
            qty = parseQuantity(quantity);
            if (qty === null || qty < 0) {
                return jsonError(res, 400, 'Quantity must be an integer (0 to remove, or 1+ to keep)');
            }
        }

        const cart = getCart(req);
        const itemIndex = cart.findIndex(item => (item.key || item.slug) === key);

        const fallbackIndex = itemIndex === -1 ? cart.findIndex(item => item.slug === key) : itemIndex;

        const resolvedIndex = fallbackIndex;

        if (resolvedIndex === -1) {
            return jsonError(res, 404, 'Item not found in cart');
        }

        if (hasQuantity) {
            if (qty === 0) {
                cart.splice(resolvedIndex, 1);
            } else {
                cart[resolvedIndex].quantity = Math.max(1, qty);
            }
        }

        if (cart[resolvedIndex]) {
            const item = cart[resolvedIndex];
            const currentQty = Math.max(1, Number.parseInt(item.quantity, 10) || 1);
            const arr = ensureRecipientsArray(item);

            if (arr.length > currentQty) {
                arr.length = currentQty;
            }

            if ((hasRecipient || hasDedication) && !hasRecipientIndex && !hasRecipientsArray) {
                const entry = normalizeRecipientEntry({
                    recipientName: hasRecipient ? recipientName : arr[0]?.recipientName,
                    dedication: hasDedication ? dedication : arr[0]?.dedication,
                });
                arr[0] = entry;
            }

            if (hasRecipientsArray) {
                if (!Array.isArray(recipients)) {
                    return jsonError(res, 400, 'Recipients must be an array');
                }
                item.recipients = recipients
                    .slice(0, currentQty)
                    .map(normalizeRecipientEntry);
            }

            if (hasRecipientIndex) {
                const idx = Number.parseInt(recipientIndex, 10);
                if (!Number.isFinite(idx) || idx < 0) {
                    return jsonError(res, 400, 'recipientIndex must be a non-negative integer');
                }
                if (idx >= currentQty) {
                    return jsonError(res, 400, 'recipientIndex out of range for current quantity');
                }

                const prev = arr[idx] || { recipientName: null, dedication: null };
                const entry = normalizeRecipientEntry({
                    recipientName: hasRecipient ? recipientName : prev.recipientName,
                    dedication: hasDedication ? dedication : prev.dedication,
                });
                arr[idx] = entry;
                if (arr.length > currentQty) arr.length = currentQty;
                item.recipients = arr;
            }
        }

        const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
        res.json({ 
            message: 'Cart updated',
            cart: cart,
            count: totalCount
        });
}));

router.delete('/remove/:key', asyncHandler((req, res) => {
        const { key } = req.params;
        const cart = getCart(req);

        const itemIndex = cart.findIndex(item => (item.key || item.slug) === key);
        const fallbackIndex = itemIndex === -1 ? cart.findIndex(item => item.slug === key) : itemIndex;
        const resolvedIndex = fallbackIndex;

        if (resolvedIndex === -1) {
            return jsonError(res, 404, 'Item not found in cart');
        }

        cart.splice(resolvedIndex, 1);
        const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
        
        res.json({ 
            message: 'Item removed from cart',
            cart: cart,
            count: totalCount
        });
}));

router.delete('/clear', (req, res) => {
    req.session.cart = [];
    res.json({ message: 'Cart cleared', cart: [] });
});

module.exports = router;

