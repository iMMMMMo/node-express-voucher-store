const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const UserModel = require('../models/userModel');
const attachUser = require('../middleware/attachUser');
const attachStoreNavigation = require('../middleware/attachStoreNavigation');

router.use(attachUser);
router.use(attachStoreNavigation);

router.get('/register', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/');
    }
    res.render('register', {
        title: 'Register | Voucher Shop',
        activePage: '',
        errors: null,
        formData: {}
    });
});

router.post('/register', [
    body('email')
        .isEmail()
        .withMessage('Please enter a valid email address')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long'),
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
], async (req, res) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        return res.render('register', {
            title: 'Register | Voucher Shop',
            activePage: '',
            errors: errors.array(),
            formData: req.body
        });
    }

    try {
        const { email, password, name } = req.body;

        const rawPrefixDigits = (req.body.phonePrefixDigits || '48').toString().trim();
        const rawNumber = (req.body.phoneNumber || '').toString().trim();
        const phone = (rawPrefixDigits && rawNumber)
            ? `+${rawPrefixDigits} ${rawNumber}`.replace(/\s+/g, ' ').trim()
            : null;

        const existingUser = await UserModel.findByEmail(email);
        if (existingUser) {
            return res.render('register', {
                title: 'Register | Voucher Shop',
                activePage: '',
                errors: [{ msg: 'An account with this email already exists' }],
                formData: req.body
            });
        }

        const user = await UserModel.create(email, password, name, phone);
        
        req.session.userId = user.id;
        req.session.userEmail = user.email;
        req.session.userName = user.name;
        req.session.userRole = user.role;

        res.redirect('/');
    } catch (error) {
        console.error('Registration error:', error);
        res.render('register', {
            title: 'Register | Voucher Shop',
            activePage: '',
            errors: [{ msg: 'Registration failed. Please try again.' }],
            formData: req.body
        });
    }
});

router.get('/login', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/');
    }
    res.render('login', {
        title: 'Login | Voucher Shop',
        activePage: '',
        errors: null,
        formData: {}
    });
});

router.post('/login', [
    body('email')
        .isEmail()
        .withMessage('Please enter a valid email address')
        .normalizeEmail(),
    body('password')
        .notEmpty()
        .withMessage('Password is required')
], async (req, res) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        return res.render('login', {
            title: 'Login | Voucher Shop',
            activePage: '',
            errors: errors.array(),
            formData: req.body
        });
    }

    try {
        const { email, password } = req.body;

        const user = await UserModel.findByEmail(email);
        if (!user) {
            return res.render('login', {
                title: 'Login | Voucher Shop',
                activePage: '',
                errors: [{ msg: 'Invalid email or password' }],
                formData: req.body
            });
        }

        const isValidPassword = await UserModel.verifyPassword(password, user.password);
        if (!isValidPassword) {
            return res.render('login', {
                title: 'Login | Voucher Shop',
                activePage: '',
                errors: [{ msg: 'Invalid email or password' }],
                formData: req.body
            });
        }

        req.session.userId = user.id;
        req.session.userEmail = user.email;
        req.session.userName = user.name;
        req.session.userRole = user.role;

        const returnTo = req.session.returnTo || '/';
        delete req.session.returnTo;
        res.redirect(returnTo);
    } catch (error) {
        console.error('Login error:', error);
        res.render('login', {
            title: 'Login | Voucher Shop',
            activePage: '',
            errors: [{ msg: 'Login failed. Please try again.' }],
            formData: req.body
        });
    }
});

router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/');
    });
});

module.exports = router;

