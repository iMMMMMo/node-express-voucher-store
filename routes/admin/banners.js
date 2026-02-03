const express = require("express");
const router = express.Router();
const BannerModel = require("../../models/bannerModel");
const { body, param, validationResult } = require("express-validator");
const AdminImageService = require("../../services/adminImageService");
const { parseIntSafe } = require("../../utils/number");
const { normalizeText } = require("../../utils/text");

const bannerImages = AdminImageService.createForAdminCategory(__dirname, {
  category: "banners",
  filenamePrefix: "banner",
  resize: { width: 2560, height: 1200 },
  maxFileSizeBytes: 8 * 1024 * 1024,
});

const parseOrder = (value) => {
  return parseIntSafe((value ?? "").toString().trim()) ?? 0;
};

router.get("/", async (req, res) => {
  try {
    const banners = await BannerModel.findAllByUserId(req.session.userId);

    return res.render("admin/layout", {
      title: "Admin | Banners",
      viewFile: "../admin/banners/index",
      viewData: {
        banners,
      },
    });
  } catch (error) {
    console.error("Error fetching banners:", error);
    return res.status(500).render("admin/layout", {
      title: "Admin | Banners",
      viewFile: "../admin/banners/index",
      viewData: {
        banners: [],
        error: "Error loading banners",
      },
    });
  }
});

router.get("/new", (req, res) => {
  return res.render("admin/layout", {
    title: "Admin | New banner",
    viewFile: "../admin/banners/form",
    viewData: {
      mode: "create",
      banner: null,
      errors: null,
      availableImages: bannerImages.listAvailableImages(),
      formData: {
        caption: "",
        content: "",
        button: "",
        link: "",
        order: "0",
        isActive: true,
        existingImage: "",
      },
    },
  });
});

router.post(
  "/",
  bannerImages.uploadSingle("image"),
  [
    body("caption")
      .optional({ nullable: true })
      .trim()
      .isLength({ max: 200 })
      .withMessage("Caption max length is 200."),
    body("content")
      .optional({ nullable: true })
      .trim()
      .isLength({ max: 5000 })
      .withMessage("Content max length is 5000."),
    body("button")
      .optional({ nullable: true })
      .trim()
      .isLength({ max: 80 })
      .withMessage("Button text max length is 80."),
    body("link")
      .optional({ nullable: true })
      .trim()
      .isLength({ max: 300 })
      .withMessage("Link max length is 300."),
    body("order")
      .optional({ nullable: true })
      .custom(() => true),
  ],
  async (req, res) => {
    const errors = validationResult(req);

    const formData = {
      caption: req.body.caption,
      content: req.body.content,
      button: req.body.button,
      link: req.body.link,
      order: (req.body.order ?? "0").toString(),
      isActive:
        req.body.isActive === "on" || req.body.isActive === "true" || req.body.isActive === true,
      existingImage: req.body.existingImage,
    };

    if (!errors.isEmpty()) {
      bannerImages.safeUnlink(req.file?.path);
      return res.status(400).render("admin/layout", {
        title: "Admin | New banner",
        viewFile: "../admin/banners/form",
        viewData: {
          mode: "create",
          banner: null,
          errors: errors.array(),
          availableImages: bannerImages.listAvailableImages(),
          formData,
        },
      });
    }

    try {
      let imagePath = bannerImages.resolveExistingImageSelection(req.body.existingImage);
      if (req.file) {
        await bannerImages.normalizeUploadedImage(req.file.path);
        imagePath = bannerImages.webPathForFilename(req.file.filename);
      }

      await BannerModel.create({
        userId: req.session.userId,
        imagePath,
        caption: normalizeText(req.body.caption, { maxLen: 200 }),
        content: normalizeText(req.body.content, { maxLen: 5000 }),
        button: normalizeText(req.body.button, { maxLen: 80 }),
        link: normalizeText(req.body.link, { maxLen: 300 }),
        order: parseOrder(req.body.order),
        isActive: formData.isActive,
      });

      req.flash("success", "Banner created.");
      return req.flashRedirect("/admin/banners");
    } catch (error) {
      bannerImages.safeUnlink(req.file?.path);
      console.error("Error creating banner:", error);
      return res.status(500).render("admin/layout", {
        title: "Admin | New banner",
        viewFile: "../admin/banners/form",
        viewData: {
          mode: "create",
          banner: null,
          errors: [{ msg: "Could not create banner." }],
          availableImages: bannerImages.listAvailableImages(),
          formData,
        },
      });
    }
  },
);

router.get(
  "/:id/edit",
  [param("id").isInt({ min: 1 }).withMessage("Invalid banner id.")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("warning", "Invalid banner id.");
      return req.flashRedirect("/admin/banners");
    }

    const id = parseIntSafe(req.params.id);
    try {
      const banner = await BannerModel.findByIdForUser(id, req.session.userId);
      if (!banner) {
        req.flash("warning", "Banner not found.");
        return req.flashRedirect("/admin/banners");
      }

      return res.render("admin/layout", {
        title: "Admin | Edit banner",
        viewFile: "../admin/banners/form",
        viewData: {
          mode: "edit",
          banner,
          errors: null,
          availableImages: bannerImages.listAvailableImages(),
          formData: {
            caption: banner.caption || "",
            content: banner.content || "",
            button: banner.button || "",
            link: banner.link || "",
            order: (banner.order ?? 0).toString(),
            isActive: !!banner.isActive,
            existingImage: "",
          },
        },
      });
    } catch (error) {
      console.error("Error loading banner for edit:", error);
      req.flash("error", "Could not load banner.");
      return req.flashRedirect("/admin/banners");
    }
  },
);

router.post(
  "/:id",
  bannerImages.uploadSingle("image"),
  [
    param("id").isInt({ min: 1 }).withMessage("Invalid banner id."),
    body("caption")
      .optional({ nullable: true })
      .trim()
      .isLength({ max: 200 })
      .withMessage("Caption max length is 200."),
    body("content")
      .optional({ nullable: true })
      .trim()
      .isLength({ max: 5000 })
      .withMessage("Content max length is 5000."),
    body("button")
      .optional({ nullable: true })
      .trim()
      .isLength({ max: 80 })
      .withMessage("Button text max length is 80."),
    body("link")
      .optional({ nullable: true })
      .trim()
      .isLength({ max: 300 })
      .withMessage("Link max length is 300."),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    const id = parseIntSafe(req.params.id);

    const banner = await BannerModel.findByIdForUser(id, req.session.userId);
    if (!banner) {
      bannerImages.safeUnlink(req.file?.path);
      req.flash("warning", "Banner not found.");
      return req.flashRedirect("/admin/banners");
    }

    const formData = {
      caption: req.body.caption,
      content: req.body.content,
      button: req.body.button,
      link: req.body.link,
      order: (req.body.order ?? "0").toString(),
      isActive:
        req.body.isActive === "on" || req.body.isActive === "true" || req.body.isActive === true,
      existingImage: req.body.existingImage,
    };

    if (!errors.isEmpty()) {
      bannerImages.safeUnlink(req.file?.path);
      return res.status(400).render("admin/layout", {
        title: "Admin | Edit banner",
        viewFile: "../admin/banners/form",
        viewData: {
          mode: "edit",
          banner,
          errors: errors.array(),
          availableImages: bannerImages.listAvailableImages(),
          formData,
        },
      });
    }

    try {
      let imagePath = banner.imagePath || null;

      const selectedExisting = bannerImages.resolveExistingImageSelection(req.body.existingImage);
      if (selectedExisting) {
        imagePath = selectedExisting;
      }

      if (req.file) {
        await bannerImages.normalizeUploadedImage(req.file.path);
        imagePath = bannerImages.webPathForFilename(req.file.filename);
      }

      await BannerModel.update(id, {
        userId: req.session.userId,
        imagePath,
        caption: normalizeText(req.body.caption, { maxLen: 200 }),
        content: normalizeText(req.body.content, { maxLen: 5000 }),
        button: normalizeText(req.body.button, { maxLen: 80 }),
        link: normalizeText(req.body.link, { maxLen: 300 }),
        order: parseOrder(req.body.order),
        isActive: formData.isActive,
      });

      req.flash("success", "Banner updated.");
      return req.flashRedirect("/admin/banners");
    } catch (error) {
      bannerImages.safeUnlink(req.file?.path);
      console.error("Error updating banner:", error);
      return res.status(500).render("admin/layout", {
        title: "Admin | Edit banner",
        viewFile: "../admin/banners/form",
        viewData: {
          mode: "edit",
          banner,
          errors: [{ msg: "Could not update banner." }],
          availableImages: bannerImages.listAvailableImages(),
          formData,
        },
      });
    }
  },
);

router.post(
  "/:id/delete",
  [param("id").isInt({ min: 1 }).withMessage("Invalid banner id.")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("warning", "Invalid banner id.");
      return req.flashRedirect("/admin/banners");
    }

    const id = parseIntSafe(req.params.id);
    if (!id) {
      req.flash("warning", "Invalid banner id.");
      return req.flashRedirect("/admin/banners");
    }

    try {
      const banner = await BannerModel.findByIdForUser(id, req.session.userId);
      if (!banner) {
        req.flash("warning", "Banner not found.");
        return req.flashRedirect("/admin/banners");
      }

      await BannerModel.delete(id);
      req.flash("success", "Banner deleted.");
      return req.flashRedirect("/admin/banners");
    } catch (error) {
      console.error("Error deleting banner:", error);
      req.flash("error", "Could not delete banner.");
      return req.flashRedirect("/admin/banners");
    }
  },
);

module.exports = router;
