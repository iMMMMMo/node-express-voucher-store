const authRequired = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }
    req.session.returnTo = req.originalUrl;
    res.redirect('/login');
};

module.exports = authRequired;

