const express = require('express');
const router = express.Router();
const ProductModel = require('../../models/productModel');
const asyncHandler = require('../../utils/asyncHandler');

const jsonError = (res, status, message) => res.status(status).json({
    ok: false,
    error: { message },
    message,
});

router.get('/', asyncHandler(async (req, res) => {
    const products = await ProductModel.findAll();
    res.json(products);
}));

router.get('/:id', asyncHandler(async (req, res) => {
    const product = await ProductModel.findProduct({ id: req.params.id });
    if (!product) {
        return jsonError(res, 404, 'Product not found');
    }
    res.json(product);
}));

module.exports = router;