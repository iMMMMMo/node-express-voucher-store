const express = require('express');
const router = express.Router();
const ProductModel = require('../../models/productModel');

// Helper function to get cart from session
const getCart = (req) => {
    if (!req.session.cart) {
        req.session.cart = [];
    }
    return req.session.cart;
};

// GET /api/cart - Get cart items
router.get('/', (req, res) => {
    const cart = getCart(req);
    res.json(cart);
});

// GET /api/cart/count - Get cart items count
router.get('/count', (req, res) => {
    const cart = getCart(req);
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    res.json({ count });
});

// POST /api/cart/add - Add item to cart
router.post('/add', async (req, res) => {
    try {
        const { slug, quantity = 1 } = req.body;
        
        if (!slug) {
            return res.status(400).json({ message: 'Product slug is required' });
        }

        const product = await ProductModel.findBySlug(slug);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const cart = getCart(req);
        const existingItemIndex = cart.findIndex(item => item.slug === slug);

        if (existingItemIndex > -1) {
            cart[existingItemIndex].quantity += parseInt(quantity);
        } else {
            cart.push({
                slug: product.slug,
                product_id: product.product_id,
                name: product.name,
                price: parseFloat(product.finalPrice),
                imagePath: product.imagePath || '/images/cloth_1.jpg',
                quantity: parseInt(quantity)
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

// PUT /api/cart/update/:slug - Update item quantity
router.put('/update/:slug', (req, res) => {
    try {
        const { slug } = req.params;
        const { quantity } = req.body;

        if (!quantity || quantity < 0) {
            return res.status(400).json({ message: 'Valid quantity is required' });
        }

        const cart = getCart(req);
        const itemIndex = cart.findIndex(item => item.slug === slug);

        if (itemIndex === -1) {
            return res.status(404).json({ message: 'Item not found in cart' });
        }

        if (quantity === 0) {
            cart.splice(itemIndex, 1);
        } else {
            cart[itemIndex].quantity = parseInt(quantity);
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

// DELETE /api/cart/remove/:slug - Remove item from cart
router.delete('/remove/:slug', (req, res) => {
    try {
        const { slug } = req.params;
        const cart = getCart(req);
        const itemIndex = cart.findIndex(item => item.slug === slug);

        if (itemIndex === -1) {
            return res.status(404).json({ message: 'Item not found in cart' });
        }

        cart.splice(itemIndex, 1);
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

// DELETE /api/cart/clear - Clear entire cart
router.delete('/clear', (req, res) => {
    req.session.cart = [];
    res.json({ message: 'Cart cleared', cart: [] });
});

module.exports = router;

