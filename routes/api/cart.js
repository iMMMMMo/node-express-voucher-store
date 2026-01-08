const express = require('express');
const router = express.Router();
const ProductModel = require('../../models/productModel');

const getCart = (req) => {
    if (!req.session.cart) {
        req.session.cart = [];
    }
    return req.session.cart;
};

const parseQuantity = (value) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
        return null;
    }
    return parsed;
};

router.get('/', (req, res) => {
    const cart = getCart(req);
    res.json(cart);
});

router.get('/count', (req, res) => {
    const cart = getCart(req);
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    res.json({ count });
});

router.post('/add', async (req, res) => {
    try {
        const { slug, quantity = 1, selectedAttributeValueIds = [] } = req.body;
        
        if (!slug) {
            return res.status(400).json({ message: 'Product slug is required' });
        }

        const pricing = await ProductModel.getPricingForProductSelection({ slug, selectedAttributeValueIds });
        if (!pricing) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const { product, unitFinal, cartItemKey, selectedAttributeValueIds: normalizedIds } = pricing;

        const qty = parseQuantity(quantity);
        if (qty === null || qty < 1) {
            return res.status(400).json({ message: 'Quantity must be an integer of at least 1' });
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
                imagePath: product.imagePath || '/images/cloth_1.jpg',
                quantity: qty,
                selectedAttributeValueIds: normalizedIds
            });
        }

        const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
        res.json({ 
            message: 'Product added to cart',
            cart: cart,
            count: totalCount
        });
    } catch (error) {
        console.error('Error adding to cart:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

router.put('/update/:key', (req, res) => {
    try {
        const { key } = req.params;
        const { quantity } = req.body;

        const qty = parseQuantity(quantity);
        if (qty === null || qty < 0) {
            return res.status(400).json({ message: 'Quantity must be an integer (0 to remove, or 1+ to keep)' });
        }

        const cart = getCart(req);
        const itemIndex = cart.findIndex(item => (item.key || item.slug) === key);

        const fallbackIndex = itemIndex === -1 ? cart.findIndex(item => item.slug === key) : itemIndex;

        const resolvedIndex = fallbackIndex;

        if (resolvedIndex === -1) {
            return res.status(404).json({ message: 'Item not found in cart' });
        }

        if (qty === 0) {
            cart.splice(resolvedIndex, 1);
        } else {
            cart[resolvedIndex].quantity = Math.max(1, qty);
        }

        const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
        res.json({ 
            message: 'Cart updated',
            cart: cart,
            count: totalCount
        });
    } catch (error) {
        console.error('Error updating cart:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

router.delete('/remove/:key', (req, res) => {
    try {
        const { key } = req.params;
        const cart = getCart(req);

        const itemIndex = cart.findIndex(item => (item.key || item.slug) === key);
        const fallbackIndex = itemIndex === -1 ? cart.findIndex(item => item.slug === key) : itemIndex;
        const resolvedIndex = fallbackIndex;

        if (resolvedIndex === -1) {
            return res.status(404).json({ message: 'Item not found in cart' });
        }

        cart.splice(resolvedIndex, 1);
        const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
        
        res.json({ 
            message: 'Item removed from cart',
            cart: cart,
            count: totalCount
        });
    } catch (error) {
        console.error('Error removing from cart:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

router.delete('/clear', (req, res) => {
    req.session.cart = [];
    res.json({ message: 'Cart cleared', cart: [] });
});

module.exports = router;

