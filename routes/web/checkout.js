const express = require('express');
const router = express.Router();

const attachUser = require('../../middleware/attachUser');
const attachStoreNavigation = require('../../middleware/attachStoreNavigation');
const authRequired = require('../../middleware/authRequired');
const asyncHandler = require('../../utils/asyncHandler');

const {
    getCheckoutPageData,
    placeCheckoutOrder,
    getThankyouPageData,
} = require('../../services/checkoutService');

router.use(attachUser);
router.use(attachStoreNavigation);

router.get('/checkout', authRequired, asyncHandler(async (req, res) => {
    const cart = req.session.cart || [];

    const data = await getCheckoutPageData({
        userId: req.session.userId,
        cart,
    });

    if (data.redirect) {
        return res.redirect(data.redirect);
    }

    req.session.cart = cart;

    return res.render('checkout', {
        title: 'Checkout | Voucher Shop',
        activePage: '',
        cart: data.cart,
        total: data.total,
        errors: data.errors,
        deliveryAddresses: data.deliveryAddresses,
        formData: data.formData,
    });
}));

router.post('/checkout', authRequired, asyncHandler(async (req, res) => {
    const cart = req.session.cart || [];

    const result = await placeCheckoutOrder({
        userId: req.session.userId,
        cart,
        body: req.body,
    });

    req.session.cart = cart;

    if (result.redirect) {
        return res.redirect(result.redirect);
    }

    if (!result.ok) {
        const status = result.status || 400;
        const vd = result.viewData || {};
        return res.status(status).render('checkout', {
            title: 'Checkout | Voucher Shop',
            activePage: '',
            cart: vd.cart || cart,
            total: vd.total || 0,
            errors: vd.errors || [{ msg: 'Could not place order. Please try again.' }],
            deliveryAddresses: vd.deliveryAddresses || [],
            formData: vd.formData || {},
        });
    }

    req.session.cart = [];
    req.session.lastOrderId = result.orderId;
    return res.redirect('/thankyou');
}));

router.get('/thankyou', authRequired, asyncHandler(async (req, res) => {
    if (!req.session.lastOrderId) {
        return res.status(403).render('thankyou', {
            title: 'Thank you | Voucher Shop',
            activePage: '',
            accessDenied: true,
            orderId: null,
            order: null,
            summary: null,
            errors: [{ msg: 'Access denied. This page is only available right after placing an order.' }],
        });
    }

    const orderId = req.session.lastOrderId;

    try {
        const data = await getThankyouPageData({
            userId: req.session.userId,
            orderId,
        });

        if (!data.ok) {
            const status = data.status || 500;
            const message = data.error || 'Could not load order summary. Please try again.';
            return res.status(status).render('thankyou', {
                title: 'Thank you | Voucher Shop',
                activePage: '',
                accessDenied: false,
                orderId,
                order: null,
                summary: null,
                errors: [{ msg: message }],
            });
        }

        delete req.session.lastOrderId;

        return res.render('thankyou', {
            title: 'Thank you | Voucher Shop',
            activePage: '',
            accessDenied: false,
            orderId: data.order.id,
            order: data.order,
            summary: data.summary,
            errors: null,
        });
    } catch (error) {
        console.error('Error loading thankyou summary:', error);
        return res.status(500).render('thankyou', {
            title: 'Thank you | Voucher Shop',
            activePage: '',
            accessDenied: false,
            orderId,
            order: null,
            summary: null,
            errors: [{ msg: 'Could not load order summary. Please try again.' }],
        });
    }
}));

module.exports = router;
