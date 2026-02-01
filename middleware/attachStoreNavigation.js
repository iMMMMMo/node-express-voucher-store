const prisma = require("../prisma/prismaClient");

const isExternalUrl = (url) => /^https?:\/\//i.test((url ?? "").toString());

const buildNestedTree = (items) => {
  const byId = new Map(items.map((i) => [i.id, { ...i, children: [] }]));
  const roots = [];

  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (arr) => {
    arr.sort((a, b) => {
      const ao = typeof a.order === "number" ? a.order : 0;
      const bo = typeof b.order === "number" ? b.order : 0;
      if (ao !== bo) return ao - bo;
      return a.id - b.id;
    });
    arr.forEach((n) => sortNodes(n.children));
  };

  sortNodes(roots);

  // basic cycle-avoid: ensure no infinite loops by breaking self-references
  const visited = new Set();
  const clean = (node) => {
    if (visited.has(node.id)) {
      node.children = [];
      return;
    }
    visited.add(node.id);
    node.children.forEach(clean);
  };
  roots.forEach(clean);

  return roots;
};

module.exports = async (req, res, next) => {
  try {
    // only for storefront pages (not admin/api)
    if (req.path.startsWith("/admin") || req.path.startsWith("/api")) {
      res.locals.navigationTree = [];
      res.locals.currentPath = req.path;
      return next();
    }

    res.locals.currentPath = req.path;

    const rows = await prisma.navigation.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        parentId: true,
        title: true,
        url: true,
        order: true,
      },
      orderBy: [{ order: "asc" }, { id: "asc" }],
    });

    const sanitized = (rows || []).map((r) => ({
      id: r.id,
      parentId: r.parentId ?? null,
      title: (r.title ?? "").toString(),
      url: isExternalUrl(r.url) ? r.url : (r.url ?? "").toString(),
      order: typeof r.order === "number" ? r.order : 0,
    }));

    res.locals.navigationTree = buildNestedTree(sanitized);
    return next();
  } catch (error) {
    console.error("Error attaching store navigation:", error);
    res.locals.navigationTree = [];
    res.locals.currentPath = req.path;
    return next();
  }
};
