const express = require('express');
const router = express.Router();

const prisma = require('../../prisma/prismaClient');
const authRequired = require('../../middleware/authRequired');
const asyncHandler = require('../../utils/asyncHandler');
const { decimalToNumber } = require('../../utils/number');

router.get('/', authRequired, asyncHandler(async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.session.userId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { items: true } },
    }
  });

  res.render('orders', {
    title: 'My Orders | Voucher Shop',
    activePage: '',
    orders: orders.map((o) => ({
      id: o.id,
      createdAt: o.createdAt,
      status: o.status,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      deliveryMethod: o.deliveryMethod,
      totalPrice: decimalToNumber(o.totalPrice),
      itemsCount: o._count?.items ?? 0,
    })),
    errors: null,
  });
}));

router.get('/:id', authRequired, asyncHandler(async (req, res) => {
  const orderId = Number.parseInt(req.params.id, 10);
  if (!Number.isFinite(orderId) || orderId <= 0) {
    return res.status(400).render('order-details', {
      title: 'Order details | Voucher Shop',
      activePage: '',
      order: null,
      summary: null,
      errors: [{ msg: 'Invalid order id.' }],
    });
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: req.session.userId },
    include: {
      user: { select: { email: true, name: true } },
      deliveryAddress: true,
      items: {
        include: { product: { select: { name: true, slug: true } } },
        orderBy: { id: 'asc' }
      }
    }
  });

  if (!order) {
    return res.status(404).render('order-details', {
      title: 'Order details | Voucher Shop',
      activePage: '',
      order: null,
      summary: null,
      errors: [{ msg: 'Order not found.' }],
    });
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const itemsSubtotal = items.reduce((sum, it) => {
    const qty = Number.parseInt(it.quantity, 10) || 0;
    const price = decimalToNumber(it.finalPrice);
    return sum + (qty * price);
  }, 0);

  const summary = {
    itemsSubtotal,
    deliveryPrice: decimalToNumber(order.deliveryPrice),
    paymentPrice: decimalToNumber(order.paymentPrice),
    total: decimalToNumber(order.totalPrice),
    items: items.map((it) => ({
      id: it.id,
      productName: it.product?.name || 'Product',
      productSlug: it.product?.slug || null,
      quantity: Number.parseInt(it.quantity, 10) || 0,
      unitPrice: decimalToNumber(it.unitPrice),
      finalPrice: decimalToNumber(it.finalPrice),
      recipientName: it.recipientName || null,
      dedication: it.dedication || null,
      selectedAttributes: it.selectedAttributes || null,
    }))
  };

  res.render('order-details', {
    title: `Order #${order.id} | Voucher Shop`,
    activePage: '',
    order,
    summary,
    errors: null,
  });
}));

module.exports = router;
