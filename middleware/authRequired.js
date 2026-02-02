const authRequired = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }
    req.session.returnTo = req.originalUrl;

    if (typeof req.flash === 'function') {
        req.flash('info', 'Log in to access this page.');
    }

    if (typeof req.flashRedirect === 'function') {
        return req.flashRedirect('/auth/login');
    }

    return res.redirect('/auth/login');
};

module.exports = authRequired;

