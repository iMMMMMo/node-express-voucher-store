const express = require('express');
const router = express.Router();
const ProductModel = require('../models/productModel');
const attachUser = require('../middleware/attachUser');

router.use(attachUser);

router.get('/', (req, res) => {
    res.render('index', { 
        title: 'Home | Shoppers', 
        activePage: 'home' 
    });
});

router.get('/shop', async (req, res) => {
    try {
        const products = await ProductModel.findAll();
        res.render('shop', { 
            title: 'Shop | Shoppers', 
            activePage: 'shop',
            products: products
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).render('shop', { 
            title: 'Shop | Shoppers', 
            activePage: 'shop',
            products: [],
            error: 'Error loading products'
        });
    }
});

router.get('/shop-single/:slug', async (req, res) => {
    try {
        const slug = req.params.slug;
        const product = await ProductModel.findProduct({ slug });
        
        if (!product) {
            return res.status(404).render('shop-single', {
                title: 'Product Not Found | Shoppers',
                activePage: 'shop',
                product: null,
                error: 'Product not found'
            });
        }

        res.render('shop-single', { 
            title: `${product.name} | Shoppers`, 
            activePage: 'shop',
            product: product
        });
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).render('shop-single', {
            title: 'Product Details | Shoppers',
            activePage: 'shop',
            product: null,
            error: 'Error loading product'
        });
    }
});

router.get('/cart', (req, res) => {
    const cart = req.session.cart || [];
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const total = subtotal;
    
    res.render('cart', { 
        title: 'Koszyk | Shoppers', 
        activePage: 'cart',
        cart: cart,
        subtotal: subtotal,
        total: total
    });
});

router.get('/checkout', (req, res) => {
    res.render('checkout', { 
        title: 'Checkout | Shoppers', 
        activePage: '' 
    });
});

router.get('/thankyou', (req, res) => {
    res.render('thankyou', { 
        title: 'Order Confirmed | Shoppers', 
        activePage: '' 
    });
});

router.get('/about', (req, res) => {
    res.render('about', { 
        title: 'About Us | Shoppers', 
        activePage: 'about' 
    });
});

router.get('/contact', (req, res) => {
    res.render('contact', { 
        title: 'Contact Us | Shoppers', 
        activePage: 'contact' 
    });
});

module.exports = router;