const db = require('../db');

const ProductModel = {
    findAll: async () => {
        const query = `
            SELECT 
                product_id,
                name,
                slug,
                description,
                "basePrice",
                "VAT",
                "imagePath",
                "createdAt",
                ROUND("basePrice" * (1 + "VAT" / 100), 2) as "finalPrice"
            FROM product 
            ORDER BY product_id ASC
        `;
        const result = await db.query(query);
        return result.rows;
    },

    findById: async (id) => {
        const productQuery = `
            SELECT 
                product_id,
                name,
                slug,
                description,
                "basePrice",
                "VAT",
                "imagePath",
                "createdAt",
                ROUND("basePrice" * (1 + "VAT" / 100), 2) as "finalPrice"
            FROM product 
            WHERE product_id = $1
        `;
        const productResult = await db.query(productQuery, [id]);
        
        if (!productResult.rows[0]) {
            return null;
        }

        const product = productResult.rows[0];

        // Pobierz atrybuty produktu
        const attributesQuery = `
            SELECT 
                pav.value_id,
                pa.attribute_id,
                pa.name as attribute_name,
                pav.value
            FROM productattributevalue pav
            JOIN productattribute pa ON pav.attribute_id = pa.attribute_id
            WHERE pav.product_id = $1
            ORDER BY pa.name, pav.value
        `;
        const attributesResult = await db.query(attributesQuery, [id]);
        
        // Grupuj atrybuty według nazwy
        const attributes = {};
        attributesResult.rows.forEach(row => {
            if (!attributes[row.attribute_name]) {
                attributes[row.attribute_name] = [];
            }
            attributes[row.attribute_name].push({
                value_id: row.value_id,
                value: row.value
            });
        });

        product.attributes = attributes;
        return product;
    },

    findBySlug: async (slug) => {
        const productQuery = `
            SELECT 
                product_id,
                name,
                slug,
                description,
                "basePrice",
                "VAT",
                "imagePath",
                "createdAt",
                ROUND("basePrice" * (1 + "VAT" / 100), 2) as "finalPrice"
            FROM product 
            WHERE slug = $1
        `;
        const productResult = await db.query(productQuery, [slug]);
        
        if (!productResult.rows[0]) {
            return null;
        }

        const product = productResult.rows[0];

        // Pobierz atrybuty produktu
        const attributesQuery = `
            SELECT 
                pav.value_id,
                pa.attribute_id,
                pa.name as attribute_name,
                pav.value
            FROM productattributevalue pav
            JOIN productattribute pa ON pav.attribute_id = pa.attribute_id
            WHERE pav.product_id = $1
            ORDER BY pa.name, pav.value
        `;
        const attributesResult = await db.query(attributesQuery, [product.product_id]);
        
        // Grupuj atrybuty według nazwy
        const attributes = {};
        attributesResult.rows.forEach(row => {
            if (!attributes[row.attribute_name]) {
                attributes[row.attribute_name] = [];
            }
            attributes[row.attribute_name].push({
                value_id: row.value_id,
                value: row.value
            });
        });

        product.attributes = attributes;
        return product;
    }
};

module.exports = ProductModel;