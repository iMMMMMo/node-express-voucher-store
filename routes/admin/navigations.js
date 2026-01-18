const express = require("express");
const router = express.Router();
const NavigationModel = require("../../models/navigationModel");

router.get("/", async (req, res) => {
  try {
    const navigations = await NavigationModel.findAllForUser(req.session.userId);

    res.render("admin/layout", {
      title: "Admin | Navigations",
      viewFile: "../admin/navigations/index",
      viewData: {
        navigations,
      },
    });
  } catch (error) {
    console.error("Error fetching navigations:", error);
    res.status(500).render("admin/layout", {
      title: "Admin | Navigations",
      viewFile: "../admin/navigations/index",
      viewData: {
        navigations: [],
        error: "Error loading navigations",
      },
    });
  }
});

module.exports = router;
