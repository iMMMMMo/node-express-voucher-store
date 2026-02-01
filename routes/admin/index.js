const express = require('express');
const router = express.Router();

const attachUser = require('../../middleware/attachUser');
const adminRequired = require('../../middleware/adminRequired');
const flash = require('../../middleware/flash');

const adminPagesRoutes = require('./pages');
const adminProductsRoutes = require('./products');
const adminAttributesRoutes = require('./attributes');
const adminOrdersRoutes = require('./orders');
const adminBannersRoutes = require('./banners');
const adminNavigationsRoutes = require('./navigations');

router.use(attachUser);
router.use(adminRequired);
router.use(flash);

router.use('/pages', adminPagesRoutes);
router.use('/banners', adminBannersRoutes);
router.use('/products', adminProductsRoutes);
router.use('/attributes', adminAttributesRoutes);
router.use('/orders', adminOrdersRoutes);
router.use('/navigations', adminNavigationsRoutes);

router.get('/', (req, res) => {
  res.render('admin/layout', {
    title: 'Admin | Dashboard',
    viewFile: '../admin/dashboard',
    viewData: {},
  });
});

module.exports = router;
