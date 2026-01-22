const express = require("express");
const router = express.Router();
const prisma = require("../../prisma/prismaClient");
const { body, param, validationResult } = require("express-validator");
const { parseIntSafe } = require("../../utils/number");
const { normalizeText } = require("../../utils/text");

router.get("/", async (req, res) => {
  try {
    const attributes = await prisma.productAttribute.findMany({
      orderBy: { id: "asc" },
      include: { _count: { select: { values: true } } },
    });

    res.render("admin/layout", {
      title: "Admin | Attributes",
      viewFile: "../admin/attributes/index",
      viewData: {
        attributes,
        error: null,
      },
    });
  } catch (error) {
    console.error("Error fetching attributes:", error);
    res.status(500).render("admin/layout", {
      title: "Admin | Attributes",
      viewFile: "../admin/attributes/index",
      viewData: {
        attributes: [],
        error: "Error loading attributes",
      },
    });
  }
});

router.get("/new", (req, res) => {
  res.render("admin/layout", {
    title: "Admin | New attribute",
    viewFile: "../admin/attributes/form",
    viewData: {
      mode: "create",
      errors: null,
      attribute: null,
      formData: { name: "" },
    },
  });
});

router.post(
  "/",
  [body("name").trim().isLength({ min: 1, max: 120 }).withMessage("Name is required.")],
  async (req, res) => {
    const errors = validationResult(req);
    const formData = { name: req.body.name };

    if (!errors.isEmpty()) {
      return res.status(400).render("admin/layout", {
        title: "Admin | New attribute",
        viewFile: "../admin/attributes/form",
        viewData: {
          mode: "create",
          errors: errors.array(),
          attribute: null,
          formData,
        },
      });
    }

    try {
      await prisma.productAttribute.create({
        data: {
          name: normalizeText(req.body.name),
        },
      });

      return res.redirect("/admin/attributes");
    } catch (error) {
      console.error("Error creating attribute:", error);
      return res.status(500).render("admin/layout", {
        title: "Admin | New attribute",
        viewFile: "../admin/attributes/form",
        viewData: {
          mode: "create",
          errors: [{ msg: "Could not create attribute." }],
          attribute: null,
          formData,
        },
      });
    }
  }
);

router.get(
  "/:id/edit",
  [param("id").isInt({ min: 1 }).withMessage("Invalid attribute id.")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.redirect("/admin/attributes");
    }

    const id = parseIntSafe(req.params.id);
    try {
      const attribute = await prisma.productAttribute.findUnique({
        where: { id },
        include: { _count: { select: { values: true } } },
      });
      if (!attribute) {
        return res.redirect("/admin/attributes");
      }

      return res.render("admin/layout", {
        title: "Admin | Edit attribute",
        viewFile: "../admin/attributes/form",
        viewData: {
          mode: "edit",
          errors: null,
          attribute,
          formData: { name: attribute.name || "" },
        },
      });
    } catch (error) {
      console.error("Error loading attribute:", error);
      return res.redirect("/admin/attributes");
    }
  }
);

router.post(
  "/:id",
  [
    param("id").isInt({ min: 1 }).withMessage("Invalid attribute id."),
    body("name").trim().isLength({ min: 1, max: 120 }).withMessage("Name is required."),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    const id = parseIntSafe(req.params.id);
    const formData = { name: req.body.name };

    if (!id || !errors.isEmpty()) {
      const attribute = id
        ? await prisma.productAttribute.findUnique({ where: { id }, include: { _count: { select: { values: true } } } }).catch(() => null)
        : null;
      return res.status(400).render("admin/layout", {
        title: "Admin | Edit attribute",
        viewFile: "../admin/attributes/form",
        viewData: {
          mode: "edit",
          errors: errors.array().length ? errors.array() : [{ msg: "Invalid attribute." }],
          attribute,
          formData,
        },
      });
    }

    try {
      await prisma.productAttribute.update({
        where: { id },
        data: { name: normalizeText(req.body.name) },
      });

      return res.redirect("/admin/attributes");
    } catch (error) {
      console.error("Error updating attribute:", error);
      const attribute = await prisma.productAttribute.findUnique({ where: { id }, include: { _count: { select: { values: true } } } }).catch(() => null);
      return res.status(500).render("admin/layout", {
        title: "Admin | Edit attribute",
        viewFile: "../admin/attributes/form",
        viewData: {
          mode: "edit",
          errors: [{ msg: "Could not update attribute." }],
          attribute,
          formData,
        },
      });
    }
  }
);

router.post(
  "/:id/delete",
  [param("id").isInt({ min: 1 }).withMessage("Invalid attribute id.")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.redirect("/admin/attributes");
    }

    const id = parseIntSafe(req.params.id);
    if (!id) return res.redirect("/admin/attributes");

    try {
      const attribute = await prisma.productAttribute.findUnique({
        where: { id },
        include: { _count: { select: { values: true } } },
      });
      if (!attribute) return res.redirect("/admin/attributes");

      if ((attribute._count?.values || 0) > 0) {
        const attributes = await prisma.productAttribute.findMany({
          orderBy: { id: "asc" },
          include: { _count: { select: { values: true } } },
        });
        return res.status(400).render("admin/layout", {
          title: "Admin | Attributes",
          viewFile: "../admin/attributes/index",
          viewData: {
            attributes,
            error: "Cannot delete attribute that has values assigned to products.",
          },
        });
      }

      await prisma.productAttribute.delete({ where: { id } });
      return res.redirect("/admin/attributes");
    } catch (error) {
      console.error("Error deleting attribute:", error);
      return res.redirect("/admin/attributes");
    }
  }
);

module.exports = router;
