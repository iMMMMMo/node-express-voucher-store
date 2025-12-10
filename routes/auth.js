const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const UserModel = require('../models/userModel');
const attachUser = require('../middleware/attachUser');

router.use(attachUser);

router.get('/register', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/');
    }
    res.render('register', {
        title: 'Rejestracja | Shoppers',
        activePage: '',
        errors: null,
        formData: {}
    });
});

router.post('/register', [
    body('email')
        .isEmail()
        .withMessage('Podaj poprawny adres email')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Hasło musi mieć minimum 6 znaków'),
    body('name')
        .trim()
        .isLength({ min: 2 })
        .withMessage('Imię i nazwisko musi mieć minimum 2 znaki'),
    body('phone')
        .optional()
        .trim()
        .matches(/^[0-9+\-\s()]+$/)
        .withMessage('Podaj poprawny numer telefonu')
], async (req, res) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        return res.render('register', {
            title: 'Rejestracja | Shoppers',
            activePage: '',
            errors: errors.array(),
            formData: req.body
        });
    }

    try {
        const { email, password, name, phone } = req.body;

        const existingUser = await UserModel.findByEmail(email);
        if (existingUser) {
            return res.render('register', {
                title: 'Rejestracja | Shoppers',
                activePage: '',
                errors: [{ msg: 'Użytkownik o tym adresie email już istnieje' }],
                formData: req.body
            });
        }

        const user = await UserModel.create(email, password, name, phone || null);
        
        req.session.userId = user.user_id;
        req.session.userEmail = user.email;
        req.session.userName = user.name;
        req.session.userRole = user.role;

        res.redirect('/');
    } catch (error) {
        console.error('Registration error:', error);
        res.render('register', {
            title: 'Rejestracja | Shoppers',
            activePage: '',
            errors: [{ msg: 'Błąd podczas rejestracji. Spróbuj ponownie.' }],
            formData: req.body
        });
    }
});

router.get('/login', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/');
    }
    res.render('login', {
        title: 'Logowanie | Shoppers',
        activePage: '',
        errors: null,
        formData: {}
    });
});

router.post('/login', [
    body('email')
        .isEmail()
        .withMessage('Podaj poprawny adres email')
        .normalizeEmail(),
    body('password')
        .notEmpty()
        .withMessage('Hasło jest wymagane')
], async (req, res) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        return res.render('login', {
            title: 'Logowanie | Shoppers',
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
                title: 'Logowanie | Shoppers',
                activePage: '',
                errors: [{ msg: 'Nieprawidłowy email lub hasło' }],
                formData: req.body
            });
        }

        const isValidPassword = await UserModel.verifyPassword(password, user.password);
        if (!isValidPassword) {
            return res.render('login', {
                title: 'Logowanie | Shoppers',
                activePage: '',
                errors: [{ msg: 'Nieprawidłowy email lub hasło' }],
                formData: req.body
            });
        }

        req.session.userId = user.user_id;
        req.session.userEmail = user.email;
        req.session.userName = user.name;
        req.session.userRole = user.role;

        const returnTo = req.session.returnTo || '/';
        delete req.session.returnTo;
        res.redirect(returnTo);
    } catch (error) {
        console.error('Login error:', error);
        res.render('login', {
            title: 'Logowanie | Shoppers',
            activePage: '',
            errors: [{ msg: 'Błąd podczas logowania. Spróbuj ponownie.' }],
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

