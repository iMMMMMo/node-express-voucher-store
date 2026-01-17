const express = require("express");
const router = express.Router();
const BannerModel = require("../../models/bannerModel");
const { body, param, validationResult } = require("express-validator");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

const uploadDir = path.join(__dirname, "..", "..", "public", "images", "banners");
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
        webPath: `/images/banners/${name}`,
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

  let pipeline = sharp(absolutePath).rotate().resize(1200, 400, { fit: "cover" });

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
    const name = `banner-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
    if (!allowed.has(file.mimetype)) {
      return cb(new Error("Only image files are allowed."));
    }
    return cb(null, true);
  },
});

const parseId = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeEmpty = (value, maxLen = 5000) => {
  const trimmed = (value ?? "").toString().trim();
  if (!trimmed.length) return null;
  return trimmed.slice(0, maxLen);
};

const parseOrder = (value) => {
  const parsed = Number.parseInt((value ?? "").toString().trim(), 10);
  return Number.isFinite(parsed) ? parsed : 0;
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
      availableImages: listAvailableImages(),
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
  upload.single("image"),
  [
    body("caption").optional({ nullable: true }).trim().isLength({ max: 200 }).withMessage("Caption max length is 200."),
    body("content").optional({ nullable: true }).trim().isLength({ max: 5000 }).withMessage("Content max length is 5000."),
    body("button").optional({ nullable: true }).trim().isLength({ max: 80 }).withMessage("Button text max length is 80."),
    body("link").optional({ nullable: true }).trim().isLength({ max: 300 }).withMessage("Link max length is 300."),
    body("order").optional({ nullable: true }).custom(() => true),
  ],
  async (req, res) => {
    const errors = validationResult(req);

    const formData = {
      caption: req.body.caption,
      content: req.body.content,
      button: req.body.button,
      link: req.body.link,
      order: (req.body.order ?? "0").toString(),
      isActive: req.body.isActive === "on" || req.body.isActive === "true" || req.body.isActive === true,
      existingImage: req.body.existingImage,
    };

    if (!errors.isEmpty()) {
      if (req.file?.path) {
        fs.promises.unlink(req.file.path).catch(() => {});
      }
      return res.status(400).render("admin/layout", {
        title: "Admin | New banner",
        viewFile: "../admin/banners/form",
        viewData: {
          mode: "create",
          banner: null,
          errors: errors.array(),
          availableImages: listAvailableImages(),
          formData,
        },
      });
    }

    try {
      let imagePath = resolveExistingImageSelection(req.body.existingImage);
      if (req.file) {
        await normalizeUploadedImage(req.file.path);
        imagePath = `/images/banners/${req.file.filename}`;
      }

      await BannerModel.create({
        userId: req.session.userId,
        imagePath,
        caption: normalizeEmpty(req.body.caption, 200),
        content: normalizeEmpty(req.body.content, 5000),
        button: normalizeEmpty(req.body.button, 80),
        link: normalizeEmpty(req.body.link, 300),
        order: parseOrder(req.body.order),
        isActive: formData.isActive,
      });

      return res.redirect("/admin/banners");
    } catch (error) {
      if (req.file?.path) {
        fs.promises.unlink(req.file.path).catch(() => {});
      }
      console.error("Error creating banner:", error);
      return res.status(500).render("admin/layout", {
        title: "Admin | New banner",
        viewFile: "../admin/banners/form",
        viewData: {
          mode: "create",
          banner: null,
          errors: [{ msg: "Could not create banner." }],
          availableImages: listAvailableImages(),
          formData,
        },
      });
    }
  }
);

router.get(
  "/:id/edit",
  [param("id").isInt({ min: 1 }).withMessage("Invalid banner id.")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.redirect("/admin/banners");

    const id = parseId(req.params.id);
    try {
      const banner = await BannerModel.findByIdForUser(id, req.session.userId);
      if (!banner) return res.redirect("/admin/banners");

      return res.render("admin/layout", {
        title: "Admin | Edit banner",
        viewFile: "../admin/banners/form",
        viewData: {
          mode: "edit",
          banner,
          errors: null,
          availableImages: listAvailableImages(),
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
      return res.redirect("/admin/banners");
    }
  }
);

router.post(
  "/:id",
  upload.single("image"),
  [
    param("id").isInt({ min: 1 }).withMessage("Invalid banner id."),
    body("caption").optional({ nullable: true }).trim().isLength({ max: 200 }).withMessage("Caption max length is 200."),
    body("content").optional({ nullable: true }).trim().isLength({ max: 5000 }).withMessage("Content max length is 5000."),
    body("button").optional({ nullable: true }).trim().isLength({ max: 80 }).withMessage("Button text max length is 80."),
    body("link").optional({ nullable: true }).trim().isLength({ max: 300 }).withMessage("Link max length is 300."),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    const id = parseId(req.params.id);

    const banner = await BannerModel.findByIdForUser(id, req.session.userId);
    if (!banner) {
      if (req.file?.path) fs.promises.unlink(req.file.path).catch(() => {});
      return res.redirect("/admin/banners");
    }

    const formData = {
      caption: req.body.caption,
      content: req.body.content,
      button: req.body.button,
      link: req.body.link,
      order: (req.body.order ?? "0").toString(),
      isActive: req.body.isActive === "on" || req.body.isActive === "true" || req.body.isActive === true,
      existingImage: req.body.existingImage,
    };

    if (!errors.isEmpty()) {
      if (req.file?.path) fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(400).render("admin/layout", {
        title: "Admin | Edit banner",
        viewFile: "../admin/banners/form",
        viewData: {
          mode: "edit",
          banner,
          errors: errors.array(),
          availableImages: listAvailableImages(),
          formData,
        },
      });
    }

    try {
      let imagePath = banner.imagePath || null;

      const selectedExisting = resolveExistingImageSelection(req.body.existingImage);
      if (selectedExisting) {
        imagePath = selectedExisting;
      }

      if (req.file) {
        await normalizeUploadedImage(req.file.path);
        imagePath = `/images/banners/${req.file.filename}`;
      }

      await BannerModel.update(id, {
        userId: req.session.userId,
        imagePath,
        caption: normalizeEmpty(req.body.caption, 200),
        content: normalizeEmpty(req.body.content, 5000),
        button: normalizeEmpty(req.body.button, 80),
        link: normalizeEmpty(req.body.link, 300),
        order: parseOrder(req.body.order),
        isActive: formData.isActive,
      });

      return res.redirect("/admin/banners");
    } catch (error) {
      if (req.file?.path) fs.promises.unlink(req.file.path).catch(() => {});
      console.error("Error updating banner:", error);
      return res.status(500).render("admin/layout", {
        title: "Admin | Edit banner",
        viewFile: "../admin/banners/form",
        viewData: {
          mode: "edit",
          banner,
          errors: [{ msg: "Could not update banner." }],
          availableImages: listAvailableImages(),
          formData,
        },
      });
    }
  }
);

router.post(
  "/:id/delete",
  [param("id").isInt({ min: 1 }).withMessage("Invalid banner id.")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.redirect("/admin/banners");

    const id = parseId(req.params.id);

    try {
      const banner = await BannerModel.findByIdForUser(id, req.session.userId);
      if (!banner) return res.redirect("/admin/banners");

      await BannerModel.delete(id);
      return res.redirect("/admin/banners");
    } catch (error) {
      console.error("Error deleting banner:", error);
      return res.redirect("/admin/banners");
    }
  }
);

module.exports = router;
