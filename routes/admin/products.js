const express = require("express");
const router = express.Router();
const ProductModel = require("../../models/productModel");
const prisma = require("../../prisma/prismaClient");
const { Prisma } = require("@prisma/client");

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

const parseId = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseMoney = (value) => {
  if (value === null || typeof value === "undefined") return 0;
  const asString = (value ?? "").toString().trim().replace(",", ".");
  const parsed = Number.parseFloat(asString);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
};

router.get("/:id/attributes", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.redirect("/admin/products");

  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        attributes: {
          include: { attribute: true },
          orderBy: [{ attributeId: "asc" }, { id: "asc" }],
        },
      },
    });

    if (!product) return res.redirect("/admin/products");

    res.render("admin/layout", {
      title: `Admin | Product attributes`,
      viewFile: "../admin/products/attributes",
      viewData: {
        product,
        saved: req.query.saved === "1",
      },
    });
  } catch (error) {
    console.error("Error loading product attributes:", error);
    return res.redirect("/admin/products");
  }
});

router.post("/:id/attributes", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.redirect("/admin/products");

  try {
    const values = await prisma.productAttributeValue.findMany({
      where: { productId: id },
      select: { id: true },
    });

    await prisma.$transaction(
      values.map((v) => {
        const field = `priceDelta_${v.id}`;
        const delta = parseMoney(req.body[field]);
        return prisma.productAttributeValue.update({
          where: { id: v.id },
          data: { priceDelta: new Prisma.Decimal(delta.toFixed(2)) },
        });
      })
    );

    return res.redirect(`/admin/products/${id}/attributes?saved=1`);
  } catch (error) {
    console.error("Error updating attribute deltas:", error);
    return res.redirect(`/admin/products/${id}/attributes`);
  }
});

module.exports = router;
