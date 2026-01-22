const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');

const attachUser = require('../middleware/attachUser');
const attachStoreNavigation = require('../middleware/attachStoreNavigation');
const authRequired = require('../middleware/authRequired');
const UserAddressModel = require('../models/userAddressModel');
const asyncHandler = require('../utils/asyncHandler');

router.use(attachUser);
router.use(attachStoreNavigation);

const isPoland = (country) => {
    const c = (country || '').toString().trim().toLowerCase();
    return c === 'poland' || c === 'polska' || c === 'pl';
};

const validatePostalCode = () => body('postalCode')
    .trim()
    .custom((value, { req }) => {
        const country = req.body.country;
        const v = (value || '').toString().trim();
        if (!v) throw new Error('Postal code is required');
        if (isPoland(country)) {
            if (!/^\d{2}-\d{3}$/.test(v)) {
                throw new Error('Postal code must be in format 00-000');
            }
            return true;
        }

        if (!/^[A-Za-z0-9\s-]{2,15}$/.test(v)) {
            throw new Error('Postal code is invalid');
        }
        return true;
    });

const renderAddresses = async (req, res, { status = 200, errors = null, success = null, formData = null } = {}) => {
    const userId = req.session.userId;
    const addresses = await UserAddressModel.listDeliveryByUserId(userId);

    return res.status(status).render('addresses', {
        title: 'Delivery addresses | Voucher Shop',
        activePage: '',
        addresses,
        errors,
        success,
        formData: formData || {
            street: '',
            city: '',
            postalCode: '',
            country: 'Poland',
            isDefault: addresses.length === 0
        }
    });
};

router.get('/addresses', authRequired, asyncHandler(async (req, res) => {
    const success = (req.query.success || '').toString();
    const msg = success === 'created'
        ? 'Address added.'
        : (success === 'default'
            ? 'Default address updated.'
            : (success === 'deleted'
                ? 'Address deleted.'
                : (success === 'updated' ? 'Address updated.' : null)));

    return renderAddresses(req, res, { success: msg });
}));

router.post('/addresses', [
    authRequired,
    body('street').trim().isLength({ min: 2 }).withMessage('Street is required'),
    body('city').trim().isLength({ min: 2 }).withMessage('City is required'),
    body('country').trim().isLength({ min: 2 }).withMessage('Country is required'),
    validatePostalCode(),
    body('isDefault').optional().toBoolean(),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    const formData = {
        street: req.body.street,
        city: req.body.city,
        postalCode: req.body.postalCode,
        country: req.body.country,
        isDefault: Boolean(req.body.isDefault)
    };

    if (!errors.isEmpty()) {
        return renderAddresses(req, res, {
            status: 400,
            errors: errors.array(),
            formData
        });
    }

    try {
        const userId = req.session.userId;
        await UserAddressModel.createDelivery(userId, formData);
        return res.redirect('/addresses?success=created');
    } catch (error) {
        console.error('Create address error:', error);
        return renderAddresses(req, res, {
            status: 500,
            errors: [{ msg: 'Could not add address. Please try again.' }],
            formData
        });
    }
}));

router.get('/addresses/:id/edit', [
    authRequired,
    param('id').isInt({ min: 1 }).withMessage('Invalid address id')
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return renderAddresses(req, res, {
            status: 400,
            errors: errors.array()
        });
    }

    const userId = req.session.userId;
    const addressId = Number.parseInt(req.params.id, 10);
    const address = await UserAddressModel.findDeliveryById(userId, addressId);
    if (!address) {
        return renderAddresses(req, res, {
            status: 404,
            errors: [{ msg: 'Address not found' }]
        });
    }

    return res.status(200).render('address-edit', {
        title: 'Edit address | Voucher Shop',
        activePage: '',
        address,
        errors: null,
        formData: {
            street: address.street,
            city: address.city,
            postalCode: address.postalCode,
            country: address.country,
            isDefault: Boolean(address.isDefault)
        }
    });
}));

router.post('/addresses/:id/edit', [
    authRequired,
    param('id').isInt({ min: 1 }).withMessage('Invalid address id'),
    body('street').trim().isLength({ min: 2 }).withMessage('Street is required'),
    body('city').trim().isLength({ min: 2 }).withMessage('City is required'),
    body('country').trim().isLength({ min: 2 }).withMessage('Country is required'),
    validatePostalCode(),
    body('isDefault').optional().toBoolean(),
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    const formData = {
        street: req.body.street,
        city: req.body.city,
        postalCode: req.body.postalCode,
        country: req.body.country,
        isDefault: Boolean(req.body.isDefault)
    };

    if (!errors.isEmpty()) {
        const addressId = Number.parseInt(req.params.id, 10);
        const address = await UserAddressModel.findDeliveryById(req.session.userId, addressId);
        if (!address) {
            return renderAddresses(req, res, {
                status: 404,
                errors: [{ msg: 'Address not found' }]
            });
        }

        return res.status(400).render('address-edit', {
            title: 'Edit address | Voucher Shop',
            activePage: '',
            address,
            errors: errors.array(),
            formData
        });
    }

    try {
        const userId = req.session.userId;
        const addressId = Number.parseInt(req.params.id, 10);
        await UserAddressModel.updateDelivery(userId, addressId, formData);
        return res.redirect('/addresses?success=updated');
    } catch (error) {
        console.error('Update address error:', error);
        if (error && error.code === 'ADDRESS_NOT_FOUND') {
            return renderAddresses(req, res, {
                status: 404,
                errors: [{ msg: 'Address not found' }]
            });
        }

        const addressId = Number.parseInt(req.params.id, 10);
        const address = await UserAddressModel.findDeliveryById(req.session.userId, addressId);
        if (!address) {
            return renderAddresses(req, res, {
                status: 404,
                errors: [{ msg: 'Address not found' }]
            });
        }

        return res.status(500).render('address-edit', {
            title: 'Edit address | Voucher Shop',
            activePage: '',
            address,
            errors: [{ msg: 'Could not update address. Please try again.' }],
            formData
        });
    }
}));

router.post('/addresses/:id/default', [
    authRequired,
    param('id').isInt({ min: 1 }).withMessage('Invalid address id')
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return renderAddresses(req, res, {
            status: 400,
            errors: errors.array()
        });
    }

    try {
        const userId = req.session.userId;
        const addressId = Number.parseInt(req.params.id, 10);
        await UserAddressModel.setDefaultDelivery(userId, addressId);
        return res.redirect('/addresses?success=default');
    } catch (error) {
        console.error('Set default address error:', error);
        if (error && error.code === 'ADDRESS_NOT_FOUND') {
            return renderAddresses(req, res, {
                status: 404,
                errors: [{ msg: 'Address not found' }]
            });
        }
        return renderAddresses(req, res, {
            status: 500,
            errors: [{ msg: 'Could not set default address. Please try again.' }]
        });
    }
}));

router.post('/addresses/:id/delete', [
    authRequired,
    param('id').isInt({ min: 1 }).withMessage('Invalid address id')
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return renderAddresses(req, res, {
            status: 400,
            errors: errors.array()
        });
    }

    try {
        const userId = req.session.userId;
        const addressId = Number.parseInt(req.params.id, 10);

        const deleted = await UserAddressModel.deleteDelivery(userId, addressId);
        if (!deleted || deleted.count === 0) {
            return renderAddresses(req, res, {
                status: 404,
                errors: [{ msg: 'Address not found' }]
            });
        }

        return res.redirect('/addresses?success=deleted');
    } catch (error) {
        console.error('Delete address error:', error);
        return renderAddresses(req, res, {
            status: 500,
            errors: [{ msg: 'Could not delete address. Please try again.' }]
        });
    }
}));

module.exports = router;
