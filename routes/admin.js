const express = require("express");
const router = express.Router();
const attachUser = require("../middleware/attachUser");
const adminRequired = require("../middleware/adminRequired");
const adminPagesRoutes = require("./admin/pages");
const adminProductsRoutes = require("./admin/products");
const adminAttributesRoutes = require("./admin/attributes");

router.use(attachUser);
router.use(adminRequired);

router.use("/pages", adminPagesRoutes);
router.use("/products", adminProductsRoutes);
router.use("/attributes", adminAttributesRoutes);

router.get("/", (req, res) => {
  res.render("admin/layout", {
    title: "Admin | Dashboard",
    viewFile: "../admin/dashboard",
    viewData: {}
  });
});

module.exports = router;
