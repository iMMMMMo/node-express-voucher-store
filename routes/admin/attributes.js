const express = require("express");
const router = express.Router();
const ProductAttributeModel = require("../../models/productAttributeModel");
const { body, param, validationResult } = require("express-validator");
const { parseIntSafe } = require("../../utils/number");
const { normalizeText } = require("../../utils/text");

router.get("/", async (req, res) => {
  try {
    const attributes = await ProductAttributeModel.findAllWithValuesCount();

    res.render("admin/layout", {
      title: "Admin | Attributes",
      viewFile: "../admin/attributes/index",
      viewData: {
        attributes,
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
      await ProductAttributeModel.create({ name: normalizeText(req.body.name) });

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
      const attribute = await ProductAttributeModel.findByIdWithValuesCount(id);
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
        ? await ProductAttributeModel.findByIdWithValuesCount(id).catch(() => null)
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
      await ProductAttributeModel.update(id, { name: normalizeText(req.body.name) });

      return res.redirect("/admin/attributes");
    } catch (error) {
      console.error("Error updating attribute:", error);
      const attribute = await ProductAttributeModel.findByIdWithValuesCount(id).catch(() => null);
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
      req.flash("error", "Invalid attribute id.");
      return req.flashRedirect("/admin/attributes");
    }

    const id = parseIntSafe(req.params.id);
    if (!id) {
      req.flash("error", "Invalid attribute id.");
      return req.flashRedirect("/admin/attributes");
    }

    try {
      const attribute = await ProductAttributeModel.findByIdWithValuesCount(id);
      if (!attribute) {
        req.flash("error", "Attribute not found.");
        return req.flashRedirect("/admin/attributes");
      }

      if ((attribute._count?.values || 0) > 0) {
        req.flash("error", "Cannot delete attribute that has values assigned to products.");
        return req.flashRedirect("/admin/attributes");
      }

      await ProductAttributeModel.delete(id);
      req.flash("success", "Attribute deleted.");
      return req.flashRedirect("/admin/attributes");
    } catch (error) {
      console.error("Error deleting attribute:", error);
      req.flash("error", "Could not delete attribute.");
      return req.flashRedirect("/admin/attributes");
    }
  }
);

module.exports = router;
