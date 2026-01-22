const express = require("express");
const router = express.Router();
const PageModel = require("../../models/pageModel");
const { body, param, validationResult } = require("express-validator");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const { parseIntSafe } = require("../../utils/number");
const { normalizeText } = require("../../utils/text");

const uploadDir = path.join(__dirname, "..", "..", "public", "images", "pages");
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
        webPath: `/images/pages/${name}`,
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

  let pipeline = sharp(absolutePath).rotate().resize(800, 450, { fit: "cover" });

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
    const name = `page-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
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
      availableImages: listAvailableImages(),
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
  upload.single("image"),
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
          availableImages: listAvailableImages(),
          formData,
        },
      });
    }

    try {
      let imagePath = resolveExistingImageSelection(req.body.existingImage);
      if (req.file) {
        await normalizeUploadedImage(req.file.path);
        imagePath = `/images/pages/${req.file.filename}`;
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
      if (req.file?.path) {
        fs.promises.unlink(req.file.path).catch(() => {});
      }
      const uniqueMessage = handleUniqueUrlError(error);
      const serverErrors = uniqueMessage ? [{ msg: uniqueMessage }] : [{ msg: "Could not create page." }];

      console.error("Error creating page:", error);
      return res.status(500).render("admin/layout", {
        title: "Admin | New page",
        viewFile: "../admin/pages/form",
        viewData: {
          mode: "create",
          errors: serverErrors,
          availableImages: listAvailableImages(),
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
          availableImages: listAvailableImages(),
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
  upload.single("image"),
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
          availableImages: listAvailableImages(),
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
        await normalizeUploadedImage(req.file.path);
        imagePath = `/images/pages/${req.file.filename}`;
      } else {
        const rawExisting = (req.body.existingImage ?? "").toString().trim();
        if (rawExisting === "") {
          imagePath = null;
        } else {
          imagePath = resolveExistingImageSelection(rawExisting) || existingPage.imagePath || null;
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
      if (req.file?.path) {
        fs.promises.unlink(req.file.path).catch(() => {});
      }
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
          availableImages: listAvailableImages(),
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
    const id = parseIntSafe(req.params.id);
    if (!id) {
      return res.redirect("/admin/pages");
    }

    try {
      const existingPage = await PageModel.findByIdForUser(id, req.session.userId);
      if (!existingPage) {
        return res.redirect("/admin/pages");
      }

      await PageModel.delete(id);
      return res.redirect("/admin/pages");
    } catch (error) {
      console.error("Error deleting page:", error);
      return res.status(500).render("admin/layout", {
        title: "Admin | Pages",
        viewFile: "../admin/pages/index",
        viewData: {
          pages: await PageModel.findAllByUserId(req.session.userId).catch(() => []),
          error: "Could not delete page.",
        },
      });
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
        availableImages: listAvailableImages(),
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
          availableImages: listAvailableImages(),
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