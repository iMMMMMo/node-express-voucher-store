const express = require('express');
const router = express.Router();

const prisma = require('../prisma/prismaClient');
const attachUser = require('../middleware/attachUser');
const authRequired = require('../middleware/authRequired');

router.use(attachUser);

const decimalToNumber = (d) => {
  if (d === null || typeof d === 'undefined') return 0;
  if (typeof d === 'number') return d;
  if (typeof d === 'string') {
    const n = Number.parseFloat(d);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof d.toString === 'function') {
    const n = Number.parseFloat(d.toString());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

router.get('/orders', authRequired, async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error loading orders list:', error);
    res.status(500).render('orders', {
      title: 'My Orders | Voucher Shop',
      activePage: '',
      orders: [],
      errors: [{ msg: 'Could not load your orders. Please try again.' }],
    });
  }
});

router.get('/orders/:id', authRequired, async (req, res) => {
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

  try {
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
  } catch (error) {
    console.error('Error loading order details:', error);
    res.status(500).render('order-details', {
      title: 'Order details | Voucher Shop',
      activePage: '',
      order: null,
      summary: null,
      errors: [{ msg: 'Could not load order details. Please try again.' }],
    });
  }
});

module.exports = router;
