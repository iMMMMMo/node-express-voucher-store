const express = require('express');
const router = express.Router();

router.use('/', require('./shop'));
router.use('/', require('./cart'));
router.use('/', require('./checkout'));
router.use('/', require('./auth'));
router.use('/', require('./account'));
router.use('/', require('./addresses'));
router.use('/', require('./orders'));

module.exports = router;
