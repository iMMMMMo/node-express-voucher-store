const express = require('express');
const router = express.Router();
const ProductModel = require('../models/productModel');
const PageModel = require('../models/pageModel');
const attachUser = require('../middleware/attachUser');
const authRequired = require('../middleware/authRequired');
const prisma = require('../prisma/prismaClient');
const { Prisma } = require('@prisma/client');

router.use(attachUser);

router.get('/', (req, res) => {
    res.render('index', { 
        title: 'Home | Voucher Shop', 
        activePage: 'home' 
    });
});

router.get('/shop', async (req, res) => {
    try {
        const products = await ProductModel.findAll();
        res.render('shop', { 
            title: 'Shop | Voucher Shop', 
            activePage: 'shop',
            products: products
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).render('shop', { 
            title: 'Shop | Voucher Shop', 
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
                title: 'Product Not Found | Voucher Shop',
                activePage: 'shop',
                product: null,
                error: 'Product not found'
            });
        }

        res.render('shop-single', { 
            title: `${product.name} | Voucher Shop`, 
            activePage: 'shop',
            product: product
        });
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).render('shop-single', {
            title: 'Product Details | Voucher Shop',
            activePage: 'shop',
            product: null,
            error: 'Error loading product'
        });
    }
});

router.get('/cart', async (req, res) => {
    const cart = req.session.cart || [];
    const reason = (req.query.reason || '').toString();
    const notice = reason === 'empty'
        ? 'Cannot proceed to checkout because your cart is empty. Add at least one product to continue.'
        : null;

    const needsRepair = cart.some(item => {
        const price = Number(item.price);
        return !Number.isFinite(price);
    });

    if (cart.length && needsRepair) {
        try {
            const slugs = cart.map(i => i.slug).filter(Boolean);
            const products = await prisma.product.findMany({
                where: { slug: { in: slugs } },
                select: { slug: true, basePrice: true, vat: true, imagePath: true, name: true }
            });
            const bySlug = new Map(products.map(p => [p.slug, p]));

            cart.forEach((item) => {
                const p = bySlug.get(item.slug);
                if (!p) return;

                const base = Number.parseFloat(p.basePrice?.toString?.() ?? String(p.basePrice));
                const vat = Number.parseFloat(p.vat?.toString?.() ?? String(p.vat));
                const safeBase = Number.isFinite(base) ? base : 0;
                const safeVat = Number.isFinite(vat) ? vat : 0;
                const finalPrice = safeBase * (1 + safeVat / 100);

                if (!Number.isFinite(Number(item.price))) {
                    item.price = Number.isFinite(finalPrice) ? finalPrice : 0;
                }
                if (!item.name) {
                    item.name = p.name;
                }
                if (!item.imagePath) {
                    item.imagePath = p.imagePath || '/images/cloth_1.jpg';
                }
            });

            req.session.cart = cart;
        } catch (error) {
            console.error('Error repairing cart prices:', error);
        }
    }

    const total = cart.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.quantity) || 0)), 0);

    res.render('cart', {
        title: 'Cart | Voucher Shop',
        activePage: 'cart',
        cart,
        total,
        notice
    });
});

router.get('/checkout', authRequired, (req, res) => {
    const cart = req.session.cart || [];
    if (!cart.length) {
        return res.redirect('/cart?reason=empty');
    }

    const total = cart.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.quantity) || 0)), 0);

    res.render('checkout', {
        title: 'Checkout | Voucher Shop',
        activePage: '',
        cart,
        total,
        errors: null,
        formData: {
            paymentMethod: 'BANK_TRANSFER',
            deliveryMethod: 'E_DELIVERY'
        }
    });
});

router.post('/checkout', authRequired, async (req, res) => {
    const cart = req.session.cart || [];
    if (!cart.length) {
        return res.redirect('/cart?reason=empty');
    }

    const paymentMethod = (req.body.paymentMethod || '').trim();
    const deliveryMethod = (req.body.deliveryMethod || '').trim();
    const allowedPayment = new Set(['BANK_TRANSFER', 'CARD', 'PAYPAL']);
    const allowedDelivery = new Set(['E_DELIVERY', 'COURIER']);

    const errors = [];
    if (!allowedPayment.has(paymentMethod)) {
        errors.push({ msg: 'Please select a valid payment method.' });
    }
    if (!allowedDelivery.has(deliveryMethod)) {
        errors.push({ msg: 'Please select a valid delivery method.' });
    }

    const itemsTotal = cart.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.quantity) || 0)), 0);
    const deliveryPriceNumber = deliveryMethod === 'COURIER' ? 15.0 : 0.0;
    const paymentPriceNumber = 0.0;
    const total = itemsTotal + deliveryPriceNumber + paymentPriceNumber;

    if (errors.length) {
        return res.status(400).render('checkout', {
            title: 'Checkout | Voucher Shop',
            activePage: '',
            cart,
            total,
            errors,
            formData: { paymentMethod, deliveryMethod }
        });
    }

    try {
        const slugs = cart.map(i => i.slug);
        const products = await prisma.product.findMany({
            where: { slug: { in: slugs } },
            select: { id: true, slug: true, basePrice: true, vat: true }
        });
        const bySlug = new Map(products.map(p => [p.slug, p]));

        for (const item of cart) {
            if (!bySlug.has(item.slug)) {
                return res.status(400).render('checkout', {
                    title: 'Checkout | Voucher Shop',
                    activePage: '',
                    cart,
                    total,
                    errors: [{ msg: `Product "${item.slug}" is no longer available.` }],
                    formData: { paymentMethod, deliveryMethod }
                });
            }
        }

        const order = await prisma.$transaction(async (tx) => {
            const createdOrder = await tx.order.create({
                data: {
                    userId: req.session.userId,
                    totalPrice: new Prisma.Decimal(total.toFixed(2)),
                    status: 'PLACED',
                    paymentMethod,
                    paymentPrice: new Prisma.Decimal(paymentPriceNumber.toFixed(2)),
                    paymentStatus: 'UNPAID',
                    deliveryMethod,
                    deliveryPrice: new Prisma.Decimal(deliveryPriceNumber.toFixed(2)),
                    items: {
                        create: cart.map((item) => {
                            const p = bySlug.get(item.slug);
                            const qty = Math.max(1, Number.parseInt(item.quantity, 10) || 1);
                            const base = Number.parseFloat(p.basePrice?.toString?.() ?? String(p.basePrice));
                            const vat = Number.parseFloat(p.vat?.toString?.() ?? String(p.vat));
                            const safeBase = Number.isFinite(base) ? base : 0;
                            const safeVat = Number.isFinite(vat) ? vat : 0;
                            const unitFinal = safeBase * (1 + safeVat / 100);
                            const lineFinal = unitFinal * qty;

                            return {
                                productId: p.id,
                                quantity: qty,
                                unitPrice: new Prisma.Decimal(safeBase.toFixed(2)),
                                vat: new Prisma.Decimal(safeVat.toFixed(2)),
                                finalPrice: new Prisma.Decimal(lineFinal.toFixed(2)),
                                selectedAttributes: null,
                                recipientName: null,
                                dedication: null,
                                status: 'NEW'
                            };
                        })
                    }
                },
                include: { items: true }
            });

            return createdOrder;
        });

        req.session.cart = [];
        req.session.lastOrderId = order.id;
        res.redirect('/thankyou');
    } catch (error) {
        console.error('Error placing order:', error);
        res.status(500).render('checkout', {
            title: 'Checkout | Voucher Shop',
            activePage: '',
            cart,
            total,
            errors: [{ msg: 'Could not place order. Please try again.' }],
            formData: { paymentMethod, deliveryMethod }
        });
    }
});

router.get('/thankyou', (req, res) => {
    const orderId = req.session.lastOrderId || null;
    if (req.session.lastOrderId) {
        delete req.session.lastOrderId;
    }

    res.render('thankyou', {
        title: 'Thank you | Voucher Shop',
        activePage: '',
        orderId
    });
});

router.get('/about', (req, res) => {
    res.redirect('/p/about');
});

router.get('/contact', (req, res) => {
    res.redirect('/p/contact');
});

router.get('/p/:url', async (req, res) => {
    try {
        const url = req.params.url;
        const page = await PageModel.findActiveByUrl(url);

        if (!page) {
            return res.status(404).render('page', {
                title: 'Page Not Found | Voucher Shop',
                activePage: '',
                page: { title: 'Page not found', content: null, imagePath: null },
            });
        }

        res.render('page', {
            title: `${page.title} | Voucher Shop`,
            activePage: '',
            page,
        });
    } catch (error) {
        console.error('Error fetching CMS page:', error);
        res.status(500).render('page', {
            title: 'Error | Voucher Shop',
            activePage: '',
            page: { title: 'Error', content: null, imagePath: null },
        });
    }
});

module.exports = router;