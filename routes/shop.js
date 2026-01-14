const express = require('express');
const router = express.Router();
const ProductModel = require('../models/productModel');
const PageModel = require('../models/pageModel');
const attachUser = require('../middleware/attachUser');
const authRequired = require('../middleware/authRequired');
const prisma = require('../prisma/prismaClient');
const { Prisma } = require('@prisma/client');
const sanitizeHtml = require('sanitize-html');

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

const repairCartPrices = async (cart) => {
    if (!Array.isArray(cart) || !cart.length) return cart;

    const slugs = cart.map(i => i.slug).filter(Boolean);
    const products = await prisma.product.findMany({
        where: { slug: { in: slugs } },
        select: { id: true, slug: true, basePrice: true, vat: true, imagePath: true, name: true }
    });
    const bySlug = new Map(products.map(p => [p.slug, p]));

    const allSelectedIds = cart
        .flatMap((item) => normalizeSelectedAttributeValueIds(item.selectedAttributeValueIds))
        .filter(Boolean);
    const uniqueSelectedIds = Array.from(new Set(allSelectedIds));

    const selectedRows = uniqueSelectedIds.length
        ? await prisma.productAttributeValue.findMany({
            where: { id: { in: uniqueSelectedIds } },
            include: { attribute: true }
        })
        : [];
    const selectedById = new Map(selectedRows.map(r => [r.id, r]));

    cart.forEach((item) => {
        const p = bySlug.get(item.slug);
        if (!p) return;

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

        item.selectedAttributes = selectedAttributes.length ? selectedAttributes : null;

        const deltaGrossSum = selectedAttributes.reduce((sum, row) => sum + (Number(row.priceDelta) || 0), 0);

        const deltaNetSum = vatFactor > 0 ? (deltaGrossSum / vatFactor) : deltaGrossSum;
        const unitBase = base + deltaNetSum;
        const unitFinal = unitBase * vatFactor;

        item.price = Number.isFinite(unitFinal) ? unitFinal : 0;
        if (!item.name) item.name = p.name;
        if (!item.imagePath) item.imagePath = p.imagePath || '/images/cloth_1.jpg';
    });

    return cart;
};

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

    const needsRepair = cart.some(item => !Number.isFinite(Number(item.price)))
        || cart.some(item => Array.isArray(item.selectedAttributeValueIds) && item.selectedAttributeValueIds.length);

    if (cart.length && needsRepair) {
        try {
            await repairCartPrices(cart);
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

    (async () => {
        try {
            await repairCartPrices(cart);
            req.session.cart = cart;
        } catch (error) {
            console.error('Error repairing checkout cart prices:', error);
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
    })();
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

    const deliveryPriceNumber = deliveryMethod === 'COURIER' ? 15.0 : 0.0;
    const paymentPriceNumber = 0.0;

    if (errors.length) {
        const total = cart.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.quantity) || 0)), 0)
            + deliveryPriceNumber + paymentPriceNumber;
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
        const slugs = cart.map(i => i.slug).filter(Boolean);
        const products = await prisma.product.findMany({
            where: { slug: { in: slugs } },
            select: { id: true, slug: true, basePrice: true, vat: true }
        });
        const bySlug = new Map(products.map(p => [p.slug, p]));

        const allSelectedIds = cart
            .flatMap((item) => normalizeSelectedAttributeValueIds(item.selectedAttributeValueIds))
            .filter(Boolean);
        const uniqueSelectedIds = Array.from(new Set(allSelectedIds));

        const selectedRows = uniqueSelectedIds.length
            ? await prisma.productAttributeValue.findMany({
                where: { id: { in: uniqueSelectedIds } },
                include: { attribute: true }
            })
            : [];
        const selectedById = new Map(selectedRows.map(r => [r.id, r]));

        for (const item of cart) {
            if (!bySlug.has(item.slug)) {
                const total = cart.reduce((sum, i) => sum + ((Number(i.price) || 0) * (Number(i.quantity) || 0)), 0)
                    + deliveryPriceNumber + paymentPriceNumber;
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

        const pricedItems = cart.map((item) => {
            const p = bySlug.get(item.slug);
            const qty = Math.max(1, Number.parseInt(item.quantity, 10) || 1);

            const base = toNumber(p.basePrice) ?? 0;
            const vat = toNumber(p.vat) ?? 0;
            const vatFactor = 1 + vat / 100;

            const ids = normalizeSelectedAttributeValueIds(item.selectedAttributeValueIds);
            const selectedAttributes = ids.map((id) => {
                const row = selectedById.get(id);
                if (!row || row.productId !== p.id) return null;
                return {
                    attributeId: row.attributeId,
                    attributeName: row.attribute?.name,
                    valueId: row.id,
                    value: row.value,
                    priceDelta: toNumber(row.priceDelta) ?? 0,
                };
            }).filter(Boolean);

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
        if (invalid) {
            const total = cart.reduce((sum, i) => sum + ((Number(i.price) || 0) * (Number(i.quantity) || 0)), 0)
                + deliveryPriceNumber + paymentPriceNumber;
            return res.status(400).render('checkout', {
                title: 'Checkout | Voucher Shop',
                activePage: '',
                cart,
                total,
                errors: [{ msg: invalid.error }],
                formData: { paymentMethod, deliveryMethod }
            });
        }

        const itemsTotal = pricedItems.reduce((sum, it) => sum + (Number(it.lineFinal) || 0), 0);
        const total = itemsTotal + deliveryPriceNumber + paymentPriceNumber;

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
                        create: pricedItems.flatMap((it) => {
                            const perUnit = [];
                            for (let i = 0; i < it.qty; i++) {
                                const rec = Array.isArray(it.recipients) ? it.recipients[i] : null;
                                perUnit.push({
                                    productId: it.productId,
                                    quantity: 1,
                                    unitPrice: new Prisma.Decimal(Number(it.unitBase || 0).toFixed(2)),
                                    vat: new Prisma.Decimal(Number(it.vat || 0).toFixed(2)),
                                    finalPrice: new Prisma.Decimal(Number(it.unitFinal || 0).toFixed(2)),
                                    selectedAttributes: it.selectedAttributes && it.selectedAttributes.length ? it.selectedAttributes : null,
                                    recipientName: rec?.recipientName ?? null,
                                    dedication: rec?.dedication ?? null,
                                    status: 'NEW'
                                });
                            }
                            return perUnit;
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

        const sanitizedContent = page && page.content
            ? sanitizeHtml(page.content, {
                allowedTags: [
                    'p', 'br', 'hr',
                    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                    'strong', 'b', 'em', 'i', 'u', 's',
                    'blockquote',
                    'ul', 'ol', 'li',
                    'a',
                    'span',
                    'table', 'thead', 'tbody', 'tr', 'th', 'td',
                    'pre', 'code'
                ],
                allowedAttributes: {
                    a: ['href', 'name', 'target', 'rel'],
                    '*': ['style']
                },
                allowedSchemes: ['http', 'https', 'mailto'],
                allowedStyles: {
                    '*': {
                        'text-decoration': [/^underline$/],
                        'text-align': [/^(left|right|center|justify)$/],
                        'font-weight': [/^(bold|bolder|lighter|[1-9]00)$/],
                        'font-style': [/^italic$/]
                    }
                },
                transformTags: {
                    'a': (tagName, attribs) => {
                        const attrs = { ...attribs };
                        if (attrs.target === '_blank' && !attrs.rel) {
                            attrs.rel = 'noopener noreferrer';
                        }
                        return { tagName, attribs: attrs };
                    }
                }
            })
            : null;

        const safePage = page ? { ...page, content: sanitizedContent } : page;

        res.render('page', {
            title: `${page.title} | Voucher Shop`,
            activePage: '',
            page: safePage,
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