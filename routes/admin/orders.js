const express = require("express");
const router = express.Router();
const prisma = require("../../prisma/prismaClient");
const { param, validationResult } = require("express-validator");

const decimalToNumber = (d) => {
  if (d === null || typeof d === "undefined") return 0;
  if (typeof d === "number") return d;
  if (typeof d === "string") {
    const n = Number.parseFloat(d);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof d.toString === "function") {
    const n = Number.parseFloat(d.toString());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

router.get("/", async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, email: true, name: true } },
        _count: { select: { items: true } },
      },
    });

    return res.render("admin/layout", {
      title: "Admin | Orders",
      viewFile: "../admin/orders/index",
      viewData: {
        orders: orders.map((o) => ({
          id: o.id,
          createdAt: o.createdAt,
          status: o.status,
          paymentMethod: o.paymentMethod,
          paymentStatus: o.paymentStatus,
          deliveryMethod: o.deliveryMethod,
          totalPrice: decimalToNumber(o.totalPrice),
          itemsCount: o._count?.items ?? 0,
          user: o.user
            ? {
                id: o.user.id,
                email: o.user.email,
                name: o.user.name,
              }
            : null,
        })),
        error: null,
      },
    });
  } catch (error) {
    console.error("Error loading admin orders list:", error);
    return res.status(500).render("admin/layout", {
      title: "Admin | Orders",
      viewFile: "../admin/orders/index",
      viewData: {
        orders: [],
        error: "Could not load orders.",
      },
    });
  }
});

router.get(
  "/:id",
  [param("id").isInt({ min: 1 }).withMessage("Invalid order id.")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).render("admin/layout", {
        title: "Admin | Order details",
        viewFile: "../admin/orders/details",
        viewData: {
          order: null,
          summary: null,
          errors: errors.array(),
        },
      });
    }

    const orderId = Number.parseInt(req.params.id, 10);

    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          user: { select: { id: true, email: true, name: true } },
          deliveryAddress: true,
          items: {
            include: { product: { select: { id: true, name: true, slug: true } } },
            orderBy: { id: "asc" },
          },
        },
      });

      if (!order) {
        return res.status(404).render("admin/layout", {
          title: "Admin | Order details",
          viewFile: "../admin/orders/details",
          viewData: {
            order: null,
            summary: null,
            errors: [{ msg: "Order not found." }],
          },
        });
      }

      const items = Array.isArray(order.items) ? order.items : [];
      const itemsSubtotal = items.reduce((sum, it) => {
        const qty = Number.parseInt(it.quantity, 10) || 0;
        const price = decimalToNumber(it.finalPrice);
        return sum + qty * price;
      }, 0);

      const summary = {
        itemsSubtotal,
        deliveryPrice: decimalToNumber(order.deliveryPrice),
        paymentPrice: decimalToNumber(order.paymentPrice),
        total: decimalToNumber(order.totalPrice),
        items: items.map((it) => ({
          id: it.id,
          productName: it.product?.name || "Product",
          productSlug: it.product?.slug || null,
          quantity: Number.parseInt(it.quantity, 10) || 0,
          unitPrice: decimalToNumber(it.unitPrice),
          finalPrice: decimalToNumber(it.finalPrice),
          recipientName: it.recipientName || null,
          dedication: it.dedication || null,
          selectedAttributes: it.selectedAttributes || null,
        })),
      };

      return res.render("admin/layout", {
        title: `Admin | Order #${order.id}`,
        viewFile: "../admin/orders/details",
        viewData: {
          order,
          summary,
          errors: null,
        },
      });
    } catch (error) {
      console.error("Error loading admin order details:", error);
      return res.status(500).render("admin/layout", {
        title: "Admin | Order details",
        viewFile: "../admin/orders/details",
        viewData: {
          order: null,
          summary: null,
          errors: [{ msg: "Could not load order details." }],
        },
      });
    }
  }
);

module.exports = router;
