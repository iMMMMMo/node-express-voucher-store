const express = require('express');
const router = express.Router();

const attachUser = require('../../middleware/attachUser');
const attachStoreNavigation = require('../../middleware/attachStoreNavigation');
const { getActiveBannersForHomepage } = require('../../services/bannerService');
const ProductModel = require('../../models/productModel');

router.use(attachUser);
router.use(attachStoreNavigation);

router.use('/shop', require('./shop'));
router.use('/cart', require('./cart'));
router.use('/p', require('./pages'));
router.use('/checkout', require('./checkout'));
router.use('/auth', require('./auth'));
router.use('/account', require('./account'));
router.use('/addresses', require('./addresses'));
router.use('/orders', require('./orders'));

router.get('/', async (req, res) => {
	try {
		const banners = await getActiveBannersForHomepage();
		const latestProducts = await ProductModel.findLatestForHomepage(3);

		res.render('index', {
			title: 'Home | Voucher Shop',
			activePage: 'home',
			banners,
			latestProducts,
		});
	} catch (error) {
		console.error('Error loading banners for homepage:', error);
		res.render('index', {
			title: 'Home | Voucher Shop',
			activePage: 'home',
			banners: [],
			latestProducts: [],
		});
	}
});

module.exports = router;
