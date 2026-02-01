const express = require("express");
const router = express.Router();
const NavigationModel = require("../../models/navigationModel");
const { body, param, validationResult } = require("express-validator");
const { parseIntSafe } = require("../../utils/number");
const { normalizeText: normalizeTextBase } = require("../../utils/text");

const normalizeText = (value, maxLen) => normalizeTextBase(value, { maxLen }) ?? "";

const parseOrder = (value) => {
  return parseIntSafe((value ?? "").toString().trim()) ?? 0;
};

const parseOptionalId = (value) => {
  const raw = (value ?? "").toString().trim();
  if (!raw) return null;
  return parseIntSafe(raw);
};

const isChecked = (value) => {
  return value === "on" || value === "true" || value === true;
};

const buildTreeList = (items) => {
  const byId = new Map(items.map((i) => [i.id, i]));
  const childrenMap = new Map();

  for (const item of items) {
    const key = item.parentId ?? null;
    const arr = childrenMap.get(key) ?? [];
    arr.push(item);
    childrenMap.set(key, arr);
  }

  const sortChildren = (arr) => {
    arr.sort((a, b) => {
      const ao = typeof a.order === "number" ? a.order : 0;
      const bo = typeof b.order === "number" ? b.order : 0;
      if (ao !== bo) return ao - bo;
      return a.id - b.id;
    });
  };

  for (const arr of childrenMap.values()) sortChildren(arr);

  const result = [];
  const visited = new Set();

  const visit = (node, depth) => {
    if (!node || visited.has(node.id)) return;
    visited.add(node.id);

    const parent = node.parentId ? byId.get(node.parentId) : null;
    result.push({
      ...node,
      depth,
      parent: parent ? { id: parent.id, title: parent.title } : null,
    });

    const children = childrenMap.get(node.id) ?? [];
    for (const child of children) visit(child, depth + 1);
  };

  // roots: no parent, or parent missing
  const roots = (childrenMap.get(null) ?? []).slice();
  const orphans = items.filter((i) => i.parentId && !byId.has(i.parentId));
  for (const o of orphans) roots.push(o);
  sortChildren(roots);

  for (const r of roots) visit(r, 0);

  // any remaining (cycles etc)
  for (const item of items) {
    if (!visited.has(item.id)) visit(item, 0);
  }

  return result;
};

const getDescendantIds = (items, rootId) => {
  const childrenMap = new Map();
  for (const item of items) {
    const key = item.parentId ?? null;
    const arr = childrenMap.get(key) ?? [];
    arr.push(item.id);
    childrenMap.set(key, arr);
  }

  const result = new Set();
  const stack = [rootId];
  const seen = new Set([rootId]);

  while (stack.length) {
    const current = stack.pop();
    const kids = childrenMap.get(current) ?? [];
    for (const kid of kids) {
      if (seen.has(kid)) continue;
      seen.add(kid);
      result.add(kid);
      stack.push(kid);
    }
  }

  return result;
};

router.get("/", async (req, res) => {
  try {
    const flat = await NavigationModel.findAllFlatForUser(req.session.userId);
    const navigations = buildTreeList(flat);

    res.render("admin/layout", {
      title: "Admin | Navigations",
      viewFile: "../admin/navigations/index",
      viewData: {
        navigations,
      },
    });
  } catch (error) {
    console.error("Error fetching navigations:", error);
    res.status(500).render("admin/layout", {
      title: "Admin | Navigations",
      viewFile: "../admin/navigations/index",
      viewData: {
        navigations: [],
        error: "Error loading navigations",
      },
    });
  }
});

router.get("/new", async (req, res) => {
  const flat = await NavigationModel.findAllForUserAsParents(req.session.userId);
  const parents = buildTreeList(flat).map((p) => ({
    id: p.id,
    label: `${"— ".repeat(p.depth)}${p.title}`,
  }));
  return res.render("admin/layout", {
    title: "Admin | New navigation",
    viewFile: "../admin/navigations/form",
    viewData: {
      mode: "create",
      errors: null,
      navigation: null,
      parents,
      formData: {
        title: "",
        url: "",
        parentId: "",
        order: "0",
        isActive: true,
      },
    },
  });
});

router.post(
  "/",
  [
    body("title").trim().isLength({ min: 1, max: 160 }).withMessage("Title is required."),
    body("url").trim().isLength({ min: 1, max: 300 }).withMessage("URL is required."),
    body("order").optional({ nullable: true }).custom((value) => {
      const parsed = parseOrder(value);
      if (!Number.isFinite(parsed)) throw new Error("Order must be an integer.");
      return true;
    }),
    body("parentId").optional({ nullable: true }).custom((value) => {
      const raw = (value ?? "").toString().trim();
      if (!raw) return true;
      const parsed = parseIntSafe(raw);
      if (!parsed) throw new Error("Invalid parent.");
      return true;
    }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    const formData = {
      title: req.body.title,
      url: req.body.url,
      parentId: req.body.parentId,
      order: req.body.order,
      isActive: isChecked(req.body.isActive),
    };

    const flatParents = await NavigationModel.findAllForUserAsParents(req.session.userId);
    const parents = buildTreeList(flatParents).map((p) => ({
      id: p.id,
      label: `${"— ".repeat(p.depth)}${p.title}`,
    }));

    if (!errors.isEmpty()) {
      return res.status(400).render("admin/layout", {
        title: "Admin | New navigation",
        viewFile: "../admin/navigations/form",
        viewData: {
          mode: "create",
          errors: errors.array(),
          navigation: null,
          parents,
          formData,
        },
      });
    }

    try {
      const userId = req.session.userId;
      const parentId = parseOptionalId(req.body.parentId);
      const resolvedParentId = parentId ? (await NavigationModel.findByIdForUser(parentId, userId))?.id ?? null : null;

      await NavigationModel.create({
        userId,
        parentId: resolvedParentId,
        title: normalizeText(req.body.title, 160),
        url: normalizeText(req.body.url, 300),
        order: parseOrder(req.body.order),
        isActive: isChecked(req.body.isActive),
      });

      return res.redirect("/admin/navigations");
    } catch (error) {
      console.error("Error creating navigation:", error);
      return res.status(500).render("admin/layout", {
        title: "Admin | New navigation",
        viewFile: "../admin/navigations/form",
        viewData: {
          mode: "create",
          errors: [{ msg: "Could not create navigation." }],
          navigation: null,
          parents,
          formData,
        },
      });
    }
  }
);

router.get(
  "/:id/edit",
  [param("id").isInt({ min: 1 }).withMessage("Invalid navigation id.")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.redirect("/admin/navigations");

    const id = parseIntSafe(req.params.id);
    const userId = req.session.userId;

    try {
      const navigation = await NavigationModel.findByIdForUser(id, userId);
      if (!navigation) return res.redirect("/admin/navigations");

      const flat = await NavigationModel.findAllForUserAsParents(userId);
      const allForDesc = await NavigationModel.findAllFlatForUser(userId);
      const descendants = getDescendantIds(allForDesc, id);
      const excludeIds = [id, ...Array.from(descendants)];

      const parents = buildTreeList(flat)
        .filter((p) => !excludeIds.includes(p.id))
        .map((p) => ({
          id: p.id,
          label: `${"— ".repeat(p.depth)}${p.title}`,
        }));

      return res.render("admin/layout", {
        title: "Admin | Edit navigation",
        viewFile: "../admin/navigations/form",
        viewData: {
          mode: "edit",
          errors: null,
          navigation,
          parents,
          formData: {
            title: navigation.title || "",
            url: navigation.url || "",
            parentId: navigation.parentId ? String(navigation.parentId) : "",
            order: typeof navigation.order === "number" ? String(navigation.order) : "0",
            isActive: Boolean(navigation.isActive),
          },
        },
      });
    } catch (error) {
      console.error("Error loading navigation:", error);
      return res.redirect("/admin/navigations");
    }
  }
);

router.post(
  "/:id",
  [
    param("id").isInt({ min: 1 }).withMessage("Invalid navigation id."),
    body("title").trim().isLength({ min: 1, max: 160 }).withMessage("Title is required."),
    body("url").trim().isLength({ min: 1, max: 300 }).withMessage("URL is required."),
    body("order").optional({ nullable: true }).custom((value) => {
      const parsed = parseOrder(value);
      if (!Number.isFinite(parsed)) throw new Error("Order must be an integer.");
      return true;
    }),
    body("parentId").optional({ nullable: true }).custom((value) => {
      const raw = (value ?? "").toString().trim();
      if (!raw) return true;
      const parsed = parseIntSafe(raw);
      if (!parsed) throw new Error("Invalid parent.");
      return true;
    }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    const id = parseIntSafe(req.params.id);
    const userId = req.session.userId;

    const formData = {
      title: req.body.title,
      url: req.body.url,
      parentId: req.body.parentId,
      order: req.body.order,
      isActive: isChecked(req.body.isActive),
    };

    const navigation = id ? await NavigationModel.findByIdForUser(id, userId).catch(() => null) : null;
    const allForDesc = await NavigationModel.findAllFlatForUser(userId).catch(() => []);
    const descendants = id ? getDescendantIds(allForDesc, id) : new Set();
    const flatParents = await NavigationModel.findAllForUserAsParents(userId).catch(() => []);
    const excludeIds = [id, ...Array.from(descendants)].filter(Boolean);
    const parents = buildTreeList(flatParents)
      .filter((p) => !excludeIds.includes(p.id))
      .map((p) => ({
        id: p.id,
        label: `${"— ".repeat(p.depth)}${p.title}`,
      }));

    const requestedParentId = parseOptionalId(req.body.parentId);
    if (requestedParentId && (requestedParentId === id || descendants.has(requestedParentId))) {
      errors.errors.push({
        type: "field",
        msg: "Parent cannot be this item or its descendant.",
        path: "parentId",
        location: "body",
        value: req.body.parentId,
      });
    }

    if (!id || !navigation || !errors.isEmpty()) {
      return res.status(400).render("admin/layout", {
        title: "Admin | Edit navigation",
        viewFile: "../admin/navigations/form",
        viewData: {
          mode: "edit",
          errors: errors.array().length ? errors.array() : [{ msg: "Invalid navigation." }],
          navigation,
          parents,
          formData,
        },
      });
    }

    try {
      const parentId = parseOptionalId(req.body.parentId);
      const resolvedParentId = parentId ? (await NavigationModel.findByIdForUser(parentId, userId))?.id ?? null : null;
      const safeParentId = resolvedParentId === id || (resolvedParentId && descendants.has(resolvedParentId)) ? null : resolvedParentId;

      const updated = await NavigationModel.updateForUser(id, userId, {
        parentId: safeParentId,
        title: normalizeText(req.body.title, 160),
        url: normalizeText(req.body.url, 300),
        order: parseOrder(req.body.order),
        isActive: isChecked(req.body.isActive),
      });

      if (!updated.ok) return res.redirect("/admin/navigations");
      return res.redirect("/admin/navigations");
    } catch (error) {
      console.error("Error updating navigation:", error);
      return res.status(500).render("admin/layout", {
        title: "Admin | Edit navigation",
        viewFile: "../admin/navigations/form",
        viewData: {
          mode: "edit",
          errors: [{ msg: "Could not update navigation." }],
          navigation,
          parents,
          formData,
        },
      });
    }
  }
);

router.post(
  "/:id/delete",
  [param("id").isInt({ min: 1 }).withMessage("Invalid navigation id.")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      req.flash("error", "Invalid navigation id.");
      return req.flashRedirect("/admin/navigations");
    }

    const id = parseIntSafe(req.params.id);
    const userId = req.session.userId;
    if (!id || !userId) {
      req.flash("error", "Invalid navigation id.");
      return req.flashRedirect("/admin/navigations");
    }

    try {
      const navigation = await NavigationModel.findByIdForUser(id, userId);
      if (!navigation) {
        req.flash("error", "Navigation item not found.");
        return req.flashRedirect("/admin/navigations");
      }

      if ((navigation._count?.children || 0) > 0) {
        req.flash("error", "Cannot delete navigation item that has children.");
        return req.flashRedirect("/admin/navigations");
      }

      await NavigationModel.deleteForUser(id, userId);

      req.flash("success", "Navigation item deleted.");
      return req.flashRedirect("/admin/navigations");
    } catch (error) {
      console.error("Error deleting navigation:", error);
      req.flash("error", "Could not delete navigation item.");
      return req.flashRedirect("/admin/navigations");
    }
  }
);

module.exports = router;
