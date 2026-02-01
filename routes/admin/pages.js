const express = require("express");
const router = express.Router();
const PageModel = require("../../models/pageModel");
const { body, param, validationResult } = require("express-validator");
const multer = require("multer");
const path = require("path");
const AdminImageService = require("../../services/adminImageService");
const { parseIntSafe } = require("../../utils/number");
const { normalizeText } = require("../../utils/text");

const pageImages = AdminImageService.createForAdminCategory(__dirname, {
  category: "pages",
  filenamePrefix: "page",
  resize: { width: 800, height: 450 },
  maxFileSizeBytes: 5 * 1024 * 1024,
});

const handleUniqueUrlError = (error) => {
  if (!error || error.code !== "P2002") return null;
  const target = Array.isArray(error.meta?.target) ? error.meta.target : [];
  if (target.includes("url")) {
    return "URL must be unique.";
  }
  return "Unique constraint violation.";
};

router.get("/", async (req, res) => {
  try {
    const pages = await PageModel.findAllByUserId(req.session.userId);

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

router.get("/new", (req, res) => {
  res.render("admin/layout", {
    title: "Admin | New page",
    viewFile: "../admin/pages/form",
    viewData: {
      mode: "create",
      errors: null,
      availableImages: pageImages.listAvailableImages(),
      formData: {
        title: "",
        url: "",
        content: "",
        existingImage: "",
      },
    },
  });
});

router.post(
  "/",
  pageImages.uploadSingle("image"),
  [
    body("title").trim().isLength({ min: 1 }).withMessage("Title is required."),
    body("url")
      .trim()
      .isLength({ min: 1 })
      .withMessage("URL is required.")
      .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .withMessage("URL must be a slug (lowercase letters, numbers, hyphens)."),
    body("content").optional({ nullable: true }).trim(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    const formData = {
      title: req.body.title,
      url: req.body.url,
      content: req.body.content,
      existingImage: req.body.existingImage,
    };

    if (!errors.isEmpty()) {
      return res.status(400).render("admin/layout", {
        title: "Admin | New page",
        viewFile: "../admin/pages/form",
        viewData: {
          mode: "create",
          errors: errors.array(),
          availableImages: pageImages.listAvailableImages(),
          formData,
        },
      });
    }

    try {
      let imagePath = pageImages.resolveExistingImageSelection(req.body.existingImage);
      if (req.file) {
        await pageImages.normalizeUploadedImage(req.file.path);
        imagePath = pageImages.webPathForFilename(req.file.filename);
      }

      await PageModel.create({
        userId: req.session.userId,
        title: (req.body.title || "").trim(),
        url: (req.body.url || "").trim(),
        content: normalizeText(req.body.content),
        imagePath,
      });

      return res.redirect("/admin/pages");
    } catch (error) {
      pageImages.safeUnlink(req.file?.path);
      const uniqueMessage = handleUniqueUrlError(error);
      const serverErrors = uniqueMessage ? [{ msg: uniqueMessage }] : [{ msg: "Could not create page." }];

      console.error("Error creating page:", error);
      return res.status(500).render("admin/layout", {
        title: "Admin | New page",
        viewFile: "../admin/pages/form",
        viewData: {
          mode: "create",
          errors: serverErrors,
          availableImages: pageImages.listAvailableImages(),
          formData,
        },
      });
    }
  }
);

router.get(
  "/:id/edit",
  [param("id").isInt({ min: 1 }).withMessage("Invalid page id.")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.redirect("/admin/pages");
    }

    const id = parseIntSafe(req.params.id);
    try {
      const page = await PageModel.findByIdForUser(id, req.session.userId);
      if (!page) {
        return res.redirect("/admin/pages");
      }

      return res.render("admin/layout", {
        title: "Admin | Edit page",
        viewFile: "../admin/pages/form",
        viewData: {
          mode: "edit",
          page,
          errors: null,
          availableImages: pageImages.listAvailableImages(),
          formData: {
            title: page.title,
            url: page.url,
            content: page.content || "",
            existingImage: page.imagePath ? path.basename(page.imagePath) : "",
          },
        },
      });
    } catch (error) {
      console.error("Error loading page:", error);
      return res.redirect("/admin/pages");
    }
  }
);

router.post(
  "/:id",
  pageImages.uploadSingle("image"),
  [
    param("id").isInt({ min: 1 }).withMessage("Invalid page id."),
    body("title").trim().isLength({ min: 1 }).withMessage("Title is required."),
    body("url")
      .trim()
      .isLength({ min: 1 })
      .withMessage("URL is required.")
      .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .withMessage("URL must be a slug (lowercase letters, numbers, hyphens)."),
    body("content").optional({ nullable: true }).trim(),
  ],
  async (req, res) => {
    const id = parseIntSafe(req.params.id);

    let existingPage = null;
    try {
      existingPage = await PageModel.findByIdForUser(id, req.session.userId);
    } catch (error) {
      console.error("Error loading page for update:", error);
    }

    const errors = validationResult(req);
    const formData = {
      title: req.body.title,
      url: req.body.url,
      content: req.body.content,
      existingImage: req.body.existingImage,
    };

    if (!errors.isEmpty()) {
      return res.status(400).render("admin/layout", {
        title: "Admin | Edit page",
        viewFile: "../admin/pages/form",
        viewData: {
          mode: "edit",
          page: existingPage || { id },
          errors: errors.array(),
          availableImages: pageImages.listAvailableImages(),
          formData,
        },
      });
    }

    try {
      if (!existingPage) {
        return res.redirect("/admin/pages");
      }

      let imagePath;
      if (req.file) {
        await pageImages.normalizeUploadedImage(req.file.path);
        imagePath = pageImages.webPathForFilename(req.file.filename);
      } else {
        const rawExisting = (req.body.existingImage ?? "").toString().trim();
        if (rawExisting === "") {
          imagePath = null;
        } else {
          imagePath = pageImages.resolveExistingImageSelection(rawExisting) || existingPage.imagePath || null;
        }
      }

      await PageModel.update(id, {
        userId: req.session.userId,
        title: (req.body.title || "").trim(),
        url: (req.body.url || "").trim(),
        content: normalizeText(req.body.content),
        imagePath,
      });

      return res.redirect("/admin/pages");
    } catch (error) {
      pageImages.safeUnlink(req.file?.path);
      const uniqueMessage = handleUniqueUrlError(error);
      const serverErrors = uniqueMessage ? [{ msg: uniqueMessage }] : [{ msg: "Could not update page." }];

      console.error("Error updating page:", error);
      return res.status(500).render("admin/layout", {
        title: "Admin | Edit page",
        viewFile: "../admin/pages/form",
        viewData: {
          mode: "edit",
          page: { id },
          errors: serverErrors,
          availableImages: pageImages.listAvailableImages(),
          formData,
        },
      });
    }
  }
);

router.post(
  "/:id/delete",
  [param("id").isInt({ min: 1 }).withMessage("Invalid page id.")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", "Invalid page id.");
      return req.flashRedirect("/admin/pages");
    }

    const id = parseIntSafe(req.params.id);
    if (!id) {
      req.flash("error", "Invalid page id.");
      return req.flashRedirect("/admin/pages");
    }

    try {
      const existingPage = await PageModel.findByIdForUser(id, req.session.userId);
      if (!existingPage) {
        req.flash("error", "Page not found.");
        return req.flashRedirect("/admin/pages");
      }

      await PageModel.delete(id);
      req.flash("success", "Page deleted.");
      return req.flashRedirect("/admin/pages");
    } catch (error) {
      console.error("Error deleting page:", error);
      req.flash("error", "Could not delete page.");
      return req.flashRedirect("/admin/pages");
    }
  }
);

router.use((err, req, res, next) => {
  if (!err) return next();

  const message = err instanceof multer.MulterError
    ? err.message
    : (err.message || "Upload failed.");

  const formData = {
    title: req.body?.title ?? "",
    url: req.body?.url ?? "",
    content: req.body?.content ?? "",
  };

  const isEdit = typeof req.params?.id !== "undefined";

  if (!isEdit) {
    return res.status(400).render("admin/layout", {
      title: "Admin | New page",
      viewFile: "../admin/pages/form",
      viewData: {
        mode: "create",
        errors: [{ msg: message }],
        availableImages: pageImages.listAvailableImages(),
        formData,
      },
    });
  }

  const id = parseIntSafe(req.params.id);
  if (!id) {
    return res.redirect("/admin/pages");
  }

  return PageModel.findByIdForUser(id, req.session.userId)
    .then((page) => {
      if (!page) return res.redirect("/admin/pages");

      return res.status(400).render("admin/layout", {
        title: "Admin | Edit page",
        viewFile: "../admin/pages/form",
        viewData: {
          mode: "edit",
          page,
          errors: [{ msg: message }],
          availableImages: pageImages.listAvailableImages(),
          formData: {
            title: formData.title || page.title,
            url: formData.url || page.url,
            content: (formData.content !== "") ? formData.content : (page.content || ""),
            existingImage: (formData.existingImage ?? (page.imagePath ? path.basename(page.imagePath) : "")),
          },
        },
      });
    })
    .catch((e) => {
      console.error("Upload error while loading page:", e);
      return res.redirect("/admin/pages");
    });
});

module.exports = router;