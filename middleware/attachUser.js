module.exports = (req, res, next) => {
  res.locals.userId = req.session.userId;
  res.locals.userName = req.session.userName;
  res.locals.userEmail = req.session.userEmail;
  res.locals.userRole = req.session.userRole;
  next();
};
