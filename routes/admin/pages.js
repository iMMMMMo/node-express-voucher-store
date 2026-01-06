const express = require("express");
const router = express.Router();
const PageModel = require("../../models/pageModel");

router.get("/", async (req, res) => {
  try {
    const pages = await PageModel.findAll();

    res.render("admin/layout", {
      title: "Admin | Pages",
      viewFile: "../admin/pages/index",
      viewData: {
        pages,
      },
    });
  } catch (error) {
    console.error("Error fetching pages:", error);
    res.status(500).render("admin/layout", {
      title: "Admin | Pages",
      viewFile: "../admin/pages/index",
      viewData: {
        pages: [],
        error: "Error loading pages",
      },
    });
  }
});

module.exports = router;
