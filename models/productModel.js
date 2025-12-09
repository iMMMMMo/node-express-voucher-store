const db = require('../db');

const ProductModel = {
    findAll: async () => {
        const result = await db.query('SELECT * FROM products ORDER BY id ASC');
        return result.rows;
    },

    findById: async (id) => {
        const result = await db.query('SELECT * FROM products WHERE id = $1', [id]);
        return result.rows[0];
    }
};

module.exports = ProductModel;