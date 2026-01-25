const adminRequired = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        if (req.session) {
            req.session.returnTo = req.originalUrl;
        }
        return res.redirect('/auth/login');
    }

    if (req.session.userRole !== 'admin') {
        return res.status(403).send('Forbidden');
    }

    return next();
};

module.exports = adminRequired;
