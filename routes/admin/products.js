const express = require("express");
const router = express.Router();
const ProductModel = require("../../models/productModel");
const prisma = require("../../prisma/prismaClient");
const { Prisma } = require("@prisma/client");
const { body, param, validationResult } = require("express-validator");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const uploadDir = path.join(__dirname, "..", "..", "public", "images", "products");
fs.mkdirSync(uploadDir, { recursive: true });

const listAvailableImages = () => {
  const allowedExt = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"]);
  try {
    return fs
      .readdirSync(uploadDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => allowedExt.has(path.extname(name).toLowerCase()))
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({
        name,
        webPath: `/images/products/${name}`,
      }));
  } catch {
    return [];
  }
};

const resolveExistingImageSelection = (value) => {
  const selected = (value ?? "").toString().trim();
  if (!selected) return null;

  const base = path.basename(selected);
  if (base !== selected) return null;

  const available = listAvailableImages();
  const match = available.find((img) => img.name === base);
  return match ? match.webPath : null;
};

const normalizeUploadedImage = async (absolutePath) => {
  const ext = path.extname(absolutePath).toLowerCase();
  const tmpPath = `${absolutePath}.tmp`;

  if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) return;

  let pipeline = sharp(absolutePath).rotate().resize(800, 800, { fit: "cover" });

  if (ext === ".png") pipeline = pipeline.png({ compressionLevel: 9 });
  else if (ext === ".webp") pipeline = pipeline.webp({ quality: 82 });
  else pipeline = pipeline.jpeg({ quality: 82, mozjpeg: true });

  await pipeline.toFile(tmpPath);
  await fs.promises.rename(tmpPath, absolutePath);
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const safeExt = ext && ext.length <= 10 ? ext.toLowerCase() : "";
    const name = `product-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
    if (!allowed.has(file.mimetype)) {
      return cb(new Error("Only image files are allowed."));
    }
    return cb(null, true);
  },
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

const normalizeText = (value, maxLen) => {
  const text = (value ?? "").toString().trim();
  if (!text) return null;
  return text.slice(0, maxLen);
};

const handleUniqueSlugError = (error) => {
  if (!error || error.code !== "P2002") return null;
  const target = Array.isArray(error.meta?.target) ? error.meta.target : [];
  if (target.includes("slug")) return "Slug must be unique.";
  return "Unique constraint violation.";
};

router.get("/new", (req, res) => {
  res.render("admin/layout", {
    title: "Admin | New product",
    viewFile: "../admin/products/form",
    viewData: {
      mode: "create",
      errors: null,
      availableImages: listAvailableImages(),
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
  upload.single("image"),
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
      if (req.file?.path) {
        fs.promises.unlink(req.file.path).catch(() => {});
      }
      return res.status(400).render("admin/layout", {
        title: "Admin | New product",
        viewFile: "../admin/products/form",
        viewData: {
          mode: "create",
          errors: errors.array(),
          availableImages: listAvailableImages(),
          product: null,
          formData,
        },
      });
    }

    try {
      let imagePath = resolveExistingImageSelection(req.body.existingImage);
      if (req.file) {
        await normalizeUploadedImage(req.file.path);
        imagePath = `/images/products/${req.file.filename}`;
      }

      const basePrice = parseMoney(req.body.basePrice);
      const vat = parseMoney(req.body.vat);

      await prisma.product.create({
        data: {
          name: normalizeText(req.body.name, 160),
          slug: normalizeText(req.body.slug, 160),
          description: normalizeText(req.body.description, 5000),
          basePrice: new Prisma.Decimal(basePrice.toFixed(2)),
          vat: new Prisma.Decimal(vat.toFixed(2)),
          imagePath,
        },
      });

      return res.redirect("/admin/products");
    } catch (error) {
      if (req.file?.path) {
        fs.promises.unlink(req.file.path).catch(() => {});
      }
      const uniqueMessage = handleUniqueSlugError(error);
      const serverErrors = uniqueMessage ? [{ msg: uniqueMessage }] : [{ msg: "Could not create product." }];
      console.error("Error creating product:", error);
      return res.status(500).render("admin/layout", {
        title: "Admin | New product",
        viewFile: "../admin/products/form",
        viewData: {
          mode: "create",
          errors: serverErrors,
          availableImages: listAvailableImages(),
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

    const id = parseId(req.params.id);
    try {
      const product = await prisma.product.findUnique({
        where: { id },
        include: { _count: { select: { attributes: true, orderItems: true } } },
      });
      if (!product) return res.redirect("/admin/products");

      return res.render("admin/layout", {
        title: "Admin | Edit product",
        viewFile: "../admin/products/form",
        viewData: {
          mode: "edit",
          errors: null,
          availableImages: listAvailableImages(),
          product,
          formData: {
            name: product.name || "",
            slug: product.slug || "",
            description: product.description || "",
            basePrice: product.basePrice ? product.basePrice.toString() : "0.00",
            vat: product.vat ? product.vat.toString() : "0.00",
            existingImage: "",
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
  const id = parseId(req.params.id);
  if (!id) return res.redirect("/admin/products");

  try {
    const allAttributes = await prisma.productAttribute.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });

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
  upload.single("image"),
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
    const id = parseId(req.params.id);

    const formData = {
      name: req.body.name,
      slug: req.body.slug,
      description: req.body.description,
      basePrice: req.body.basePrice,
      vat: req.body.vat,
      existingImage: req.body.existingImage,
    };

    const product = id
      ? await prisma.product
          .findUnique({ where: { id }, include: { _count: { select: { attributes: true, orderItems: true } } } })
          .catch(() => null)
      : null;

    if (!product) {
      if (req.file?.path) fs.promises.unlink(req.file.path).catch(() => {});
      return res.redirect("/admin/products");
    }

    if (!errors.isEmpty()) {
      if (req.file?.path) fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(400).render("admin/layout", {
        title: "Admin | Edit product",
        viewFile: "../admin/products/form",
        viewData: {
          mode: "edit",
          errors: errors.array(),
          availableImages: listAvailableImages(),
          product,
          formData,
        },
      });
    }

    try {
      let imagePath = product.imagePath || null;
      const selected = resolveExistingImageSelection(req.body.existingImage);
      if (typeof req.body.existingImage !== "undefined") {
        imagePath = selected;
      }
      if (req.file) {
        await normalizeUploadedImage(req.file.path);
        imagePath = `/images/products/${req.file.filename}`;
      }

      const basePrice = parseMoney(req.body.basePrice);
      const vat = parseMoney(req.body.vat);

      await prisma.product.update({
        where: { id },
        data: {
          name: normalizeText(req.body.name, 160),
          slug: normalizeText(req.body.slug, 160),
          description: normalizeText(req.body.description, 5000),
          basePrice: new Prisma.Decimal(basePrice.toFixed(2)),
          vat: new Prisma.Decimal(vat.toFixed(2)),
          imagePath,
        },
      });

      return res.redirect("/admin/products");
    } catch (error) {
      if (req.file?.path) fs.promises.unlink(req.file.path).catch(() => {});
      const uniqueMessage = handleUniqueSlugError(error);
      const serverErrors = uniqueMessage ? [{ msg: uniqueMessage }] : [{ msg: "Could not update product." }];
      console.error("Error updating product:", error);
      return res.status(500).render("admin/layout", {
        title: "Admin | Edit product",
        viewFile: "../admin/products/form",
        viewData: {
          mode: "edit",
          errors: serverErrors,
          availableImages: listAvailableImages(),
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

    const id = parseId(req.params.id);
    if (!id) return res.redirect("/admin/products");

    try {
      const product = await prisma.product.findUnique({
        where: { id },
        include: { _count: { select: { attributes: true, orderItems: true } } },
      });
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

      await prisma.product.delete({ where: { id } });
      return res.redirect("/admin/products");
    } catch (error) {
      console.error("Error deleting product:", error);
      return res.redirect("/admin/products");
    }
  }
);

router.post("/:id/attributes", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.redirect("/admin/products");

  try {
    const allAttributes = await prisma.productAttribute.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    const attributeIds = new Set(allAttributes.map((a) => a.id));

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

    const errors = [];
    const ops = [];

    const normalizeArray = (value) => {
      if (Array.isArray(value)) return value;
      if (typeof value === "undefined" || value === null) return [];
      return [value];
    };

    for (const row of product.attributes) {
      const rowId = row.id;
      const del = req.body[`row_${rowId}_delete`];

      if (del) {
        ops.push(
          prisma.productAttributeValue.delete({
            where: { id: rowId },
          })
        );
        continue;
      }

      const attributeIdRaw = req.body[`row_${rowId}_attributeId`];
      const valueRaw = req.body[`row_${rowId}_value`];
      const deltaRaw = req.body[`row_${rowId}_priceDelta`];

      const attributeId = parseId(attributeIdRaw);
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

      ops.push(
        prisma.productAttributeValue.update({
          where: { id: rowId },
          data: {
            attributeId,
            value: value.slice(0, 255),
            priceDelta: new Prisma.Decimal(delta.toFixed(2)),
          },
        })
      );
    }

    const newAttrIds = normalizeArray(req.body["new_attributeId"]);
    const newValues = normalizeArray(req.body["new_value"]);
    const newDeltas = normalizeArray(req.body["new_priceDelta"]);
    const maxLen = Math.max(newAttrIds.length, newValues.length, newDeltas.length);

    for (let i = 0; i < maxLen; i++) {
      const attributeIdRaw = newAttrIds[i];
      const valueRaw = newValues[i];
      const deltaRaw = newDeltas[i];

      const attributeId = parseId(attributeIdRaw);
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

      ops.push(
        prisma.productAttributeValue.create({
          data: {
            productId: id,
            attributeId,
            value: value.slice(0, 255),
            priceDelta: new Prisma.Decimal(delta.toFixed(2)),
          },
        })
      );
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

    if (ops.length) {
      await prisma.$transaction(ops);
    }

    return res.redirect(`/admin/products/${id}/attributes?saved=1`);
  } catch (error) {
    console.error("Error updating attribute deltas:", error);
    return res.redirect(`/admin/products/${id}/attributes`);
  }
});

module.exports = router;
