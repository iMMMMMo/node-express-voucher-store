const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

const UserModel = require('../models/userModel');
const attachUser = require('../middleware/attachUser');
const attachStoreNavigation = require('../middleware/attachStoreNavigation');
const authRequired = require('../middleware/authRequired');
const asyncHandler = require('../utils/asyncHandler');

router.use(attachUser);
router.use(attachStoreNavigation);

const normalizePhoneParts = ({ phonePrefixDigits, phoneNumber, phone }) => {
    const prefixDigits = (phonePrefixDigits || '').toString().trim();
    const number = (phoneNumber || '').toString().trim();

    if (number) {
        if (!prefixDigits) return null;
        return `+${prefixDigits} ${number}`.replace(/\s+/g, ' ').trim();
    }

    const legacy = (phone || '').toString().trim();
    if (!legacy) return null;
    return legacy.replace(/\s+/g, ' ').trim();
};

const splitPhone = (phone) => {
    const raw = (phone || '').toString().trim();
    const match = raw.match(/^(\+\d{1,4})\s*(.*)$/);
    if (!match) {
        return { phonePrefixDigits: '48', phoneNumber: raw };
    }
    return { phonePrefixDigits: (match[1] || '+48').replace(/^\+/, ''), phoneNumber: (match[2] || '').trim() };
};

const renderAccount = async (req, res, { status = 200, errors = null, success = null, profileData = null } = {}) => {
    const userId = req.session.userId;
    const user = userId ? await UserModel.findById(userId) : null;

    if (!user) {
        if (req.session) {
            req.session.destroy(() => res.redirect('/login'));
            return;
        }
        return res.redirect('/login');
    }

    const defaultPhoneParts = splitPhone(user.phone);

    return res.status(status).render('account', {
        title: 'Account | Voucher Shop',
        activePage: '',
        user,
        errors,
        success,
        formData: profileData || {
            email: user.email,
            name: user.name,
            phonePrefixDigits: defaultPhoneParts.phonePrefixDigits,
            phoneNumber: defaultPhoneParts.phoneNumber
        }
    });
};

router.get('/account', authRequired, asyncHandler(async (req, res) => {
    const updated = (req.query.updated || '').toString();
    const success = updated === 'profile'
        ? 'Your profile has been updated.'
        : (updated === 'password' ? 'Your password has been changed.' : null);

    return renderAccount(req, res, { success });
}));

router.post('/account', [
    authRequired,
    body('email')
        .isEmail()
        .withMessage('Please enter a valid email address')
        .normalizeEmail(),
    body('name')
        .trim()
        .isLength({ min: 2 })
        .withMessage('Full name must be at least 2 characters long'),
    body('phonePrefixDigits')
        .optional({ checkFalsy: true })
        .trim()
        .matches(/^\d{1,3}$/)
        .withMessage('Phone prefix must be 1–3 digits'),
    body('phoneNumber')
        .optional({ checkFalsy: true })
        .trim()
        .matches(/^[0-9\-\s()]+$/)
        .withMessage('Please enter a valid phone number'),
    body('phoneNumber')
        .custom((value, { req }) => {
            const prefixDigits = (req.body.phonePrefixDigits || '').toString().trim();
            const number = (value || '').toString().trim();
            if (!number) return true;
            if (!prefixDigits) throw new Error('Phone requires a prefix like +48');
            return true;
        })
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    const profileData = {
        email: req.body.email,
        name: req.body.name,
        phonePrefixDigits: (req.body.phonePrefixDigits || '').toString().trim() || '48',
        phoneNumber: (req.body.phoneNumber || '').toString().trim()
    };

    if (!errors.isEmpty()) {
        return renderAccount(req, res, {
            status: 400,
            errors: errors.array(),
            profileData
        });
    }

    try {
        const userId = req.session.userId;
        const existing = await UserModel.findByEmail(profileData.email);
        if (existing && existing.id !== userId) {
            return renderAccount(req, res, {
                status: 400,
                errors: [{ msg: 'An account with this email already exists' }],
                profileData
            });
        }

        const phone = normalizePhoneParts({
            phonePrefixDigits: req.body.phonePrefixDigits,
            phoneNumber: req.body.phoneNumber,
            phone: req.body.phone
        });

        if (phone && !/^\+\d{1,4}\s+/.test(phone)) {
            return renderAccount(req, res, {
                status: 400,
                errors: [{ msg: 'Phone must include a prefix like +48' }],
                profileData
            });
        }

        const updatedUser = await UserModel.updateProfile(userId, {
            email: profileData.email,
            name: profileData.name,
            phone
        });

        req.session.userEmail = updatedUser.email;
        req.session.userName = updatedUser.name;

        return res.redirect('/account?updated=profile');
    } catch (error) {
        console.error('Account profile update error:', error);
        return renderAccount(req, res, {
            status: 500,
            errors: [{ msg: 'Could not update profile. Please try again.' }],
            profileData
        });
    }
}));

router.post('/account/password', [
    authRequired,
    body('currentPassword')
        .notEmpty()
        .withMessage('Current password is required'),
    body('newPassword')
        .isLength({ min: 6 })
        .withMessage('New password must be at least 6 characters long'),
    body('confirmPassword')
        .custom((value, { req }) => value === req.body.newPassword)
        .withMessage('New passwords do not match')
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return renderAccount(req, res, {
            status: 400,
            errors: errors.array()
        });
    }

    try {
        const userId = req.session.userId;
        const user = await UserModel.findByIdWithPassword(userId);

        if (!user) {
            if (req.session) {
                req.session.destroy(() => res.redirect('/login'));
                return;
            }
            return res.redirect('/login');
        }

        const ok = await UserModel.verifyPassword(req.body.currentPassword, user.password);
        if (!ok) {
            return renderAccount(req, res, {
                status: 400,
                errors: [{ msg: 'Current password is incorrect' }]
            });
        }

        await UserModel.updatePassword(userId, req.body.newPassword);
        return res.redirect('/account?updated=password');
    } catch (error) {
        console.error('Account password change error:', error);
        return renderAccount(req, res, {
            status: 500,
            errors: [{ msg: 'Could not change password. Please try again.' }]
        });
    }
}));

module.exports = router;
