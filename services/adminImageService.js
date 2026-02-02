const fs = require("fs");
const path = require("path");
const multer = require("multer");
const sharp = require("sharp");

const DEFAULT_ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"]);
const DEFAULT_ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const listFilesSafe = (dirPath) => {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
};

const create = ({
  uploadDir,
  webBasePath,
  filenamePrefix,
  resize,
  maxFileSizeBytes,
  allowedExt = DEFAULT_ALLOWED_EXT,
  allowedMime = DEFAULT_ALLOWED_MIME,
}) => {
  ensureDir(uploadDir);

  const listAvailableImages = () => {
    return listFilesSafe(uploadDir)
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => allowedExt.has(path.extname(name).toLowerCase()))
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({
        name,
        webPath: `${webBasePath}/${name}`,
      }));
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

    let pipeline = sharp(absolutePath)
      .rotate()
      .resize(resize.width, resize.height, { fit: "cover" });

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
      const name = `${filenamePrefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
      cb(null, name);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: maxFileSizeBytes },
    fileFilter: (req, file, cb) => {
      if (!allowedMime.has(file.mimetype)) {
        return cb(new Error("Only image files are allowed."));
      }
      return cb(null, true);
    },
  });

  const safeUnlink = (filePath) => {
    if (!filePath) return;
    fs.promises.unlink(filePath).catch(() => {});
  };

  const webPathForFilename = (filename) => {
    if (!filename) return null;
    return `${webBasePath}/${filename}`;
  };

  return {
    uploadSingle: (fieldName) => {
      const single = upload.single(fieldName);

      return (req, res, next) => {
        single(req, res, (err) => {
          if (!err) return next();

          if (err && err.code === "LIMIT_FILE_SIZE") {
            const maxMb = Math.max(1, Math.ceil(maxFileSizeBytes / (1024 * 1024)));
            if (typeof req.flash === "function") {
              req.flash("warning", `Image is too large. Max file size is ${maxMb} MB.`);
            }
            const back = req.get("referer");
            return res.status(413).redirect(back || "/admin");
          }

          return next(err);
        });
      };
    },
    listAvailableImages,
    resolveExistingImageSelection,
    normalizeUploadedImage,
    safeUnlink,
    webPathForFilename,
  };
};

const createForAdminCategory = (
  routeDir,
  {
    category,
    filenamePrefix,
    resize,
    maxFileSizeBytes,
  }
) => {
  const uploadDir = path.join(routeDir, "..", "..", "public", "images", category);
  const webBasePath = `/images/${category}`;

  return create({
    uploadDir,
    webBasePath,
    filenamePrefix,
    resize,
    maxFileSizeBytes,
  });
};

module.exports = {
  create,
  createForAdminCategory,
};
