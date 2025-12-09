const db = require('../db');
const bcrypt = require('bcrypt');

const UserModel = {
    findByEmail: async (email) => {
        const query = 'SELECT * FROM users WHERE email = $1';
        const result = await db.query(query, [email]);
        return result.rows[0];
    },

    findById: async (id) => {
        const query = 'SELECT user_id, email, name, phone, role, "createdAt" FROM users WHERE user_id = $1';
        const result = await db.query(query, [id]);
        return result.rows[0];
    },

    create: async (email, password, name, phone, role = 'customer') => {
        const hashedPassword = await bcrypt.hash(password, 10);
        const query = `
            INSERT INTO users (email, password, name, phone, role)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING user_id, email, name, phone, role, "createdAt"
        `;
        const result = await db.query(query, [email, hashedPassword, name, phone, role]);
        return result.rows[0];
    },

    verifyPassword: async (plainPassword, hashedPassword) => {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }
};

module.exports = UserModel;

