const express = require("express");
const router = express.Router();

const ProductModel = require("../../models/productModel");

router.get("/", async (req, res) => {
  try {
    const products = await ProductModel.findAll();
    res.render("shop", {
      title: "Shop | Voucher Shop",
      activePage: "shop",
      products: products,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).render("shop", {
      title: "Shop | Voucher Shop",
      activePage: "shop",
      products: [],
      error: "Error loading products",
    });
  }
});

router.get("/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;
    const product = await ProductModel.findProduct({ slug });

    if (!product) {
      return res.status(404).render("shop-single", {
        title: "Product Not Found | Voucher Shop",
        activePage: "shop",
        product: null,
        error: "Product not found",
      });
    }

    res.render("shop-single", {
      title: `${product.name} | Voucher Shop`,
      activePage: "shop",
      product: product,
    });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).render("shop-single", {
      title: "Product Details | Voucher Shop",
      activePage: "shop",
      product: null,
      error: "Error loading product",
    });
  }
});

module.exports = router;
