const express = require("express");
const router = express.Router();
const ProductModel = require("../../models/productModel");

router.get("/", async (req, res) => {
  try {
    const products = await ProductModel.findAll();

    res.render("admin/layout", {
      title: "Admin | Products",
      viewFile: "../admin/products/index",
      viewData: {
        products,
      },
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).render("admin/layout", {
      title: "Admin | Products",
      viewFile: "../admin/products/index",
      viewData: {
        products: [],
        error: "Error loading products",
      },
    });
  }
});

module.exports = router;
