const prisma = require("../prisma/prismaClient");
const bcrypt = require("bcrypt");

const UserModel = {
  findByEmail: async (email) => {
    return await prisma.user.findUnique({
      where: { email },
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
        createdAt: true,
      },
    });
  },

  findByIdWithPassword: async (id) => {
    return await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        password: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });
  },

  create: async (email, password, name, phone, role = "customer") => {
    const hashedPassword = await bcrypt.hash(password, 10);

    return await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone,
        role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });
  },

  verifyPassword: async (plainPassword, hashedPassword) => {
    return await bcrypt.compare(plainPassword, hashedPassword);
  },

  updateProfile: async (id, { email, name, phone }) => {
    const phoneValue = phone === "" || typeof phone === "undefined" ? null : phone;
    return await prisma.user.update({
      where: { id },
      data: {
        email,
        name,
        phone: phoneValue,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });
  },

  updatePassword: async (id, newPassword) => {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    return await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
      select: { id: true },
    });
  },
};

module.exports = UserModel;
