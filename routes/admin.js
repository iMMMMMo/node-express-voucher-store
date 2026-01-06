const express = require("express");
const router = express.Router();
const attachUser = require("../middleware/attachUser");
const adminRequired = require("../middleware/adminRequired");
const adminPagesRoutes = require("./admin/pages");

router.use(attachUser);
router.use(adminRequired);

router.use("/pages", adminPagesRoutes);

router.get("/", (req, res) => {
  res.render("admin/layout", {
    title: "Admin | Dashboard",
    viewFile: "../admin/dashboard",
    viewData: {}
  });
});

module.exports = router;
