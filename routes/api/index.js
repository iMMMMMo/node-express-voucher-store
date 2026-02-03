const express = require("express");
const router = express.Router();

router.use("/products", require("./products"));
router.use("/cart", require("./cart"));

router.use((req, res, next) => {
  const err = new Error("Not Found");
  err.status = 404;
  err.expose = true;
  return next(err);
});

module.exports = router;
