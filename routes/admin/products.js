const express = require("express");
const router = express.Router();
const ProductModel = require("../../models/productModel");
const ProductAttributeModel = require("../../models/productAttributeModel");
const ProductAttributeValueModel = require("../../models/productAttributeValueModel");
const { body, param, validationResult } = require("express-validator");
const AdminImageService = require("../../services/adminImageService");
const { parseIntSafe } = require("../../utils/number");
const { normalizeText } = require("../../utils/text");

const productImages = AdminImageService.createForAdminCategory(__dirname, {
  category: "products",
  filenamePrefix: "product",
  resize: { width: 800, height: 800 },
  maxFileSizeBytes: 5 * 1024 * 1024,
});

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

const handleUniqueSlugError = (error) => {
  if (!error || error.code !== "P2002") return null;
  const target = Array.isArray(error.meta?.target) ? error.meta.target : [];
  if (target.includes("slug")) return "Slug must be unique.";
  return "Unique constraint violation.";
};

const parseMoney = (value) => {
  if (value === null || typeof value === "undefined") return 0;
  const asString = (value ?? "").toString().trim().replace(",", ".");
  const parsed = Number.parseFloat(asString);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
};

router.get("/new", (req, res) => {
  res.render("admin/layout", {
    title: "Admin | New product",
    viewFile: "../admin/products/form",
    viewData: {
      mode: "create",
      errors: null,
      availableImages: productImages.listAvailableImages(),
      product: null,
      formData: {
        name: "",
        slug: "",
        description: "",
        basePrice: "0.00",
        vat: "23.00",
        existingImage: "",
      },
    },
  });
});

router.post(
  "/",
  productImages.uploadSingle("image"),
  [
    body("name").trim().isLength({ min: 1, max: 160 }).withMessage("Name is required."),
    body("slug")
      .trim()
      .isLength({ min: 1, max: 160 })
      .withMessage("Slug is required.")
      .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .withMessage("Slug must be lowercase and may include numbers/hyphens."),
    body("description").optional({ nullable: true }).trim(),
    body("basePrice").custom((value) => {
      const parsed = parseMoney(value);
      if (!Number.isFinite(parsed) || parsed < 0) throw new Error("Base price must be a valid non-negative number.");
      return true;
    }),
    body("vat").custom((value) => {
      const parsed = parseMoney(value);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) throw new Error("VAT must be between 0 and 100.");
      return true;
    }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    const formData = {
      name: req.body.name,
      slug: req.body.slug,
      description: req.body.description,
      basePrice: req.body.basePrice,
      vat: req.body.vat,
      existingImage: req.body.existingImage,
    };

    if (!errors.isEmpty()) {
      productImages.safeUnlink(req.file?.path);
      return res.status(400).render("admin/layout", {
        title: "Admin | New product",
        viewFile: "../admin/products/form",
        viewData: {
          mode: "create",
          errors: errors.array(),
          availableImages: productImages.listAvailableImages(),
          product: null,
          formData,
        },
      });
    }

    try {
      let imagePath = productImages.resolveExistingImageSelection(req.body.existingImage);
      if (req.file) {
        await productImages.normalizeUploadedImage(req.file.path);
        imagePath = productImages.webPathForFilename(req.file.filename);
      }

      const basePrice = parseMoney(req.body.basePrice);
      const vat = parseMoney(req.body.vat);

      await ProductModel.create({
        name: normalizeText(req.body.name, { maxLen: 160 }),
        slug: normalizeText(req.body.slug, { maxLen: 160 }),
        description: normalizeText(req.body.description, { maxLen: 5000 }),
        basePrice,
        vat,
        imagePath,
      });

      return res.redirect("/admin/products");
    } catch (error) {
      productImages.safeUnlink(req.file?.path);
      const uniqueMessage = handleUniqueSlugError(error);
      const serverErrors = uniqueMessage ? [{ msg: uniqueMessage }] : [{ msg: "Could not create product." }];
      console.error("Error creating product:", error);
      return res.status(500).render("admin/layout", {
        title: "Admin | New product",
        viewFile: "../admin/products/form",
        viewData: {
          mode: "create",
          errors: serverErrors,
          availableImages: productImages.listAvailableImages(),
          product: null,
          formData,
        },
      });
    }
  }
);

router.get(
  "/:id/edit",
  [param("id").isInt({ min: 1 }).withMessage("Invalid product id.")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.redirect("/admin/products");

    const id = parseIntSafe(req.params.id);
    try {
      const product = await ProductModel.findByIdWithAdminCounts(id);
      if (!product) return res.redirect("/admin/products");

      const availableImages = productImages.listAvailableImages();
      const currentBase = product.imagePath ? String(product.imagePath).split("/").filter(Boolean).pop() : "";
      const existingImage = currentBase && availableImages.some((img) => String(img.name) === String(currentBase))
        ? currentBase
        : "";

      return res.render("admin/layout", {
        title: "Admin | Edit product",
        viewFile: "../admin/products/form",
        viewData: {
          mode: "edit",
          errors: null,
          availableImages,
          product,
          formData: {
            name: product.name || "",
            slug: product.slug || "",
            description: product.description || "",
            basePrice: product.basePrice ? product.basePrice.toString() : "0.00",
            vat: product.vat ? product.vat.toString() : "0.00",
            existingImage,
          },
        },
      });
    } catch (error) {
      console.error("Error loading product:", error);
      return res.redirect("/admin/products");
    }
  }
);

router.get("/:id/attributes", async (req, res) => {
  const id = parseIntSafe(req.params.id);
  if (!id) return res.redirect("/admin/products");

  try {
    const allAttributes = await ProductAttributeModel.findAllForSelect();

    const product = await ProductModel.findByIdWithAttributesForAdmin(id);

    if (!product) return res.redirect("/admin/products");

    res.render("admin/layout", {
      title: `Admin | Product attributes`,
      viewFile: "../admin/products/attributes",
      viewData: {
        product,
        allAttributes,
        saved: req.query.saved === "1",
        errors: null,
        formState: null,
      },
    });
  } catch (error) {
    console.error("Error loading product attributes:", error);
    return res.redirect("/admin/products");
  }
});

router.post(
  "/:id",
  productImages.uploadSingle("image"),
  [
    param("id").isInt({ min: 1 }).withMessage("Invalid product id."),
    body("name").trim().isLength({ min: 1, max: 160 }).withMessage("Name is required."),
    body("slug")
      .trim()
      .isLength({ min: 1, max: 160 })
      .withMessage("Slug is required.")
      .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .withMessage("Slug must be lowercase and may include numbers/hyphens."),
    body("description").optional({ nullable: true }).trim(),
    body("basePrice").custom((value) => {
      const parsed = parseMoney(value);
      if (!Number.isFinite(parsed) || parsed < 0) throw new Error("Base price must be a valid non-negative number.");
      return true;
    }),
    body("vat").custom((value) => {
      const parsed = parseMoney(value);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) throw new Error("VAT must be between 0 and 100.");
      return true;
    }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    const id = parseIntSafe(req.params.id);

    const formData = {
      name: req.body.name,
      slug: req.body.slug,
      description: req.body.description,
      basePrice: req.body.basePrice,
      vat: req.body.vat,
      existingImage: req.body.existingImage,
    };

    const product = id
      ? await ProductModel.findByIdWithAdminCounts(id).catch(() => null)
      : null;

    if (!product) {
      productImages.safeUnlink(req.file?.path);
      return res.redirect("/admin/products");
    }

    if (!errors.isEmpty()) {
      productImages.safeUnlink(req.file?.path);
      return res.status(400).render("admin/layout", {
        title: "Admin | Edit product",
        viewFile: "../admin/products/form",
        viewData: {
          mode: "edit",
          errors: errors.array(),
          availableImages: productImages.listAvailableImages(),
          product,
          formData,
        },
      });
    }

    try {
      let imagePath = product.imagePath || null;
      const selected = productImages.resolveExistingImageSelection(req.body.existingImage);
      if (typeof req.body.existingImage !== "undefined") {
        imagePath = selected;
      }
      if (req.file) {
        await productImages.normalizeUploadedImage(req.file.path);
        imagePath = productImages.webPathForFilename(req.file.filename);
      }

      const basePrice = parseMoney(req.body.basePrice);
      const vat = parseMoney(req.body.vat);

      await ProductModel.update(id, {
        name: normalizeText(req.body.name, { maxLen: 160 }),
        slug: normalizeText(req.body.slug, { maxLen: 160 }),
        description: normalizeText(req.body.description, { maxLen: 5000 }),
        basePrice,
        vat,
        imagePath,
      });

      return res.redirect("/admin/products");
    } catch (error) {
      productImages.safeUnlink(req.file?.path);
      const uniqueMessage = handleUniqueSlugError(error);
      const serverErrors = uniqueMessage ? [{ msg: uniqueMessage }] : [{ msg: "Could not update product." }];
      console.error("Error updating product:", error);
      return res.status(500).render("admin/layout", {
        title: "Admin | Edit product",
        viewFile: "../admin/products/form",
        viewData: {
          mode: "edit",
          errors: serverErrors,
          availableImages: productImages.listAvailableImages(),
          product,
          formData,
        },
      });
    }
  }
);

router.post(
  "/:id/delete",
  [param("id").isInt({ min: 1 }).withMessage("Invalid product id.")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.redirect("/admin/products");

    const id = parseIntSafe(req.params.id);
    if (!id) return res.redirect("/admin/products");

    try {
      const product = await ProductModel.findByIdWithAdminCounts(id);
      if (!product) return res.redirect("/admin/products");

      const attrsCount = product._count?.attributes || 0;
      const orderItemsCount = product._count?.orderItems || 0;
      if (attrsCount > 0 || orderItemsCount > 0) {
        const products = await ProductModel.findAll();
        return res.status(400).render("admin/layout", {
          title: "Admin | Products",
          viewFile: "../admin/products/index",
          viewData: {
            products,
            error: "Cannot delete product that has orders or attribute values assigned.",
          },
        });
      }

      await ProductModel.delete(id);
      return res.redirect("/admin/products");
    } catch (error) {
      console.error("Error deleting product:", error);
      return res.redirect("/admin/products");
    }
  }
);

router.post("/:id/attributes", async (req, res) => {
  const id = parseIntSafe(req.params.id);
  if (!id) return res.redirect("/admin/products");

  try {
    const allAttributes = await ProductAttributeModel.findAllForSelect();
    const attributeIds = new Set(allAttributes.map((a) => a.id));

    const product = await ProductModel.findByIdWithAttributesForAdmin(id);
    if (!product) return res.redirect("/admin/products");

    const errors = [];
    const deletes = [];
    const updates = [];
    const creates = [];

    const normalizeArray = (value) => {
      if (Array.isArray(value)) return value;
      if (typeof value === "undefined" || value === null) return [];
      return [value];
    };

    for (const row of product.attributes) {
      const rowId = row.id;
      const del = req.body[`row_${rowId}_delete`];

      if (del) {
        deletes.push(rowId);
        continue;
      }

      const attributeIdRaw = req.body[`row_${rowId}_attributeId`];
      const valueRaw = req.body[`row_${rowId}_value`];
      const deltaRaw = req.body[`row_${rowId}_priceDelta`];

      const attributeId = parseIntSafe(attributeIdRaw);
      const value = (valueRaw ?? "").toString().trim();
      const delta = parseMoney(deltaRaw);

      let rowHasError = false;
      if (!attributeId || !attributeIds.has(attributeId)) {
        errors.push({ msg: `Row #${rowId}: invalid attribute selected.` });
        rowHasError = true;
      }
      if (!value) {
        errors.push({ msg: `Row #${rowId}: value is required.` });
        rowHasError = true;
      }

      if (rowHasError) continue;

      updates.push({
        id: rowId,
        attributeId,
        value: value.slice(0, 255),
        priceDelta: delta,
      });
    }

    const newAttrIds = normalizeArray(req.body["new_attributeId"]);
    const newValues = normalizeArray(req.body["new_value"]);
    const newDeltas = normalizeArray(req.body["new_priceDelta"]);
    const maxLen = Math.max(newAttrIds.length, newValues.length, newDeltas.length);

    for (let i = 0; i < maxLen; i++) {
      const attributeIdRaw = newAttrIds[i];
      const valueRaw = newValues[i];
      const deltaRaw = newDeltas[i];

      const attributeId = parseIntSafe(attributeIdRaw);
      const value = (valueRaw ?? "").toString().trim();
      const delta = parseMoney(deltaRaw);

      const isEmpty = !attributeIdRaw && !valueRaw;
      if (isEmpty) continue;

      let newRowHasError = false;
      if (!attributeId || !attributeIds.has(attributeId)) {
        errors.push({ msg: `New row #${i + 1}: invalid attribute selected.` });
        newRowHasError = true;
      }
      if (!value) {
        errors.push({ msg: `New row #${i + 1}: value is required.` });
        newRowHasError = true;
      }

      if (newRowHasError) continue;

      creates.push({
        attributeId,
        value: value.slice(0, 255),
        priceDelta: delta,
      });
    }

    if (errors.length) {
      return res.status(400).render("admin/layout", {
        title: `Admin | Product attributes`,
        viewFile: "../admin/products/attributes",
        viewData: {
          product,
          allAttributes,
          saved: false,
          errors,
          formState: req.body,
        },
      });
    }

    if (deletes.length || updates.length || creates.length) {
      await ProductAttributeValueModel.applyChangesForProduct(id, {
        deletes,
        updates,
        creates,
      });
    }

    return res.redirect(`/admin/products/${id}/attributes?saved=1`);
  } catch (error) {
    console.error("Error updating attribute deltas:", error);
    return res.redirect(`/admin/products/${id}/attributes`);
  }
});

module.exports = router;
