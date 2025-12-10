const prisma = require("../prisma/prismaClient");
const bcrypt = require('bcrypt');

const UserModel = {
    findByEmail: async (email) => {
        return await prisma.user.findUnique({
            where: { email }
        });
    },

    findById: async (id) => {
        return await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                role: true,
                createdAt: true
            }
        });
    },

    create: async (email, password, name, phone, role = 'customer') => {
        const hashedPassword = await bcrypt.hash(password, 10);

        return await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                phone,
                role
            },
            select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                role: true,
                createdAt: true
            }
        });
    },

    verifyPassword: async (plainPassword, hashedPassword) => {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }
};

module.exports = UserModel;
