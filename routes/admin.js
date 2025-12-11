const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.render("admin/layout", {
    title: "Admin | Dashboard",
    viewFile: "../admin/dashboard",
    viewData: {}
  });
});

module.exports = router;
