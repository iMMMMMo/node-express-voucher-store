const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.render('index', { 
        title: 'Home | Shoppers', 
        activePage: 'home' 
    });
});

router.get('/shop', (req, res) => {
    res.render('shop', { 
        title: 'Shop | Shoppers', 
        activePage: 'shop' 
    });
});

router.get('/shop-single/:id', (req, res) => {
    const productId = req.params.id;
    res.render('shop-single', { 
        title: 'Product Details | Shoppers', 
        activePage: 'shop',
        productId: productId 
    });
});

router.get('/cart', (req, res) => {
    res.render('cart', { 
        title: 'Shopping Cart | Shoppers', 
        activePage: 'cart' 
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