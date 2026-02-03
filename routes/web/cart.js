const express = require("express");
const router = express.Router();

const asyncHandler = require("../../utils/asyncHandler");
const { repairCartPrices } = require("../../services/cartPricingService");

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const cart = req.session.cart || [];
    const reason = (req.query.reason || "").toString();
    const notice =
      reason === "empty"
        ? "Cannot proceed to checkout because your cart is empty. Add at least one product to continue."
        : null;

    const needsRepair =
      cart.some((item) => !Number.isFinite(Number(item.price))) ||
      cart.some(
        (item) =>
          Array.isArray(item.selectedAttributeValueIds) && item.selectedAttributeValueIds.length,
      );

    if (cart.length && needsRepair) {
      try {
        await repairCartPrices(cart);
        req.session.cart = cart;
      } catch (error) {
        console.error("Error repairing cart prices:", error);
      }
    }

    const total = cart.reduce(
      (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
      0,
    );

    res.render("cart", {
      title: "Cart | Voucher Shop",
      activePage: "cart",
      cart,
      total,
      notice,
    });
  }),
);

module.exports = router;
