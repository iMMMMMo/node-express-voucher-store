const prisma = require('../prisma/prismaClient');

const UserAddressModel = {
    listDeliveryByUserId: async (userId) => {
        return await prisma.userAddress.findMany({
            where: {
                userId,
                type: 'delivery'
            },
            orderBy: [
                { isDefault: 'desc' },
                { createdAt: 'desc' },
                { id: 'desc' }
            ]
        });
    },

    createDelivery: async (userId, { street, city, postalCode, country, isDefault }) => {
        const makeDefault = Boolean(isDefault);

        const create = async (tx) => {
            if (makeDefault) {
                await tx.userAddress.updateMany({
                    where: { userId, type: 'delivery' },
                    data: { isDefault: false }
                });
            }

            return await tx.userAddress.create({
                data: {
                    userId,
                    street,
                    city,
                    postalCode,
                    country,
                    type: 'delivery',
                    isDefault: makeDefault
                }
            });
        };

        return await prisma.$transaction((tx) => create(tx));
    },

    setDefaultDelivery: async (userId, addressId) => {
        return await prisma.$transaction(async (tx) => {
            await tx.userAddress.updateMany({
                where: { userId, type: 'delivery' },
                data: { isDefault: false }
            });

            const updated = await tx.userAddress.updateMany({
                where: { id: addressId, userId, type: 'delivery' },
                data: { isDefault: true }
            });

            if (!updated || updated.count !== 1) {
                const err = new Error('Address not found');
                err.code = 'ADDRESS_NOT_FOUND';
                throw err;
            }

            return await tx.userAddress.findFirst({
                where: { id: addressId, userId, type: 'delivery' }
            });
        });
    },

    deleteDelivery: async (userId, addressId) => {
        return await prisma.userAddress.deleteMany({
            where: {
                id: addressId,
                userId,
                type: 'delivery'
            }
        });
    },

    findDeliveryById: async (userId, addressId) => {
        return await prisma.userAddress.findFirst({
            where: {
                id: addressId,
                userId,
                type: 'delivery'
            }
        });
    },

    updateDelivery: async (userId, addressId, { street, city, postalCode, country, isDefault }) => {
        const makeDefault = Boolean(isDefault);

        return await prisma.$transaction(async (tx) => {
            const exists = await tx.userAddress.findFirst({
                where: { id: addressId, userId, type: 'delivery' },
                select: { id: true }
            });

            if (!exists) {
                const err = new Error('Address not found');
                err.code = 'ADDRESS_NOT_FOUND';
                throw err;
            }

            if (makeDefault) {
                await tx.userAddress.updateMany({
                    where: { userId, type: 'delivery' },
                    data: { isDefault: false }
                });
            }

            await tx.userAddress.updateMany({
                where: { id: addressId, userId, type: 'delivery' },
                data: {
                    street,
                    city,
                    postalCode,
                    country,
                    isDefault: makeDefault
                }
            });

            return await tx.userAddress.findFirst({
                where: { id: addressId, userId, type: 'delivery' }
            });
        });
    }
};

module.exports = UserAddressModel;
