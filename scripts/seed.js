/* eslint-disable no-console */

require("dotenv").config();

const bcrypt = require("bcrypt");
const prisma = require("../prisma/prismaClient");

function printHelp() {
  console.log(`\
Usage:
  npm run seed

Optional:
  npm run seed -- --help

What it does:
  - Creates a couple of test users (admin + customer) if missing
  - Creates sample products, attributes and attribute values
  - Creates basic navigation items (Home, Shop)
  - Creates basic pages (About, Contact)

Notes:
  - Requires DATABASE_URL in environment (.env supported)
  - Seed is designed to be safe to re-run (it only creates missing data; it never overwrites existing records)
  - Default passwords can be overridden via env:
      SEED_ADMIN_PASSWORD, SEED_CUSTOMER_PASSWORD
`);
}

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token) continue;

    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }

    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const [rawKey, rawInlineValue] = token.slice(2).split("=");
    const key = rawKey.trim();

    if (!key) {
      throw new Error(`Invalid argument: ${token}`);
    }

    if (typeof rawInlineValue !== "undefined") {
      args[key] = rawInlineValue;
      continue;
    }

    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

async function ensureUser({ email, password, role, name, phone = null }) {
  const normalizedEmail = String(email).trim().toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, role: true },
  });

  if (existing) {
    return { user: existing, created: false };
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const created = await prisma.user.create({
    data: {
      email: normalizedEmail,
      password: hashedPassword,
      name,
      phone,
      role,
    },
    select: { id: true, email: true, role: true },
  });

  return { user: created, created: true };
}

async function ensureAttribute(name) {
  const existing = await prisma.productAttribute.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.productAttribute.create({ data: { name } });
}

async function ensureAttributeValue({ productId, attributeId, value, priceDelta = "0" }) {
  const existing = await prisma.productAttributeValue.findFirst({
    where: { productId, attributeId, value },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };

  const created = await prisma.productAttributeValue.create({
    data: {
      productId,
      attributeId,
      value,
      priceDelta,
    },
    select: { id: true },
  });

  return { id: created.id, created: true };
}

async function ensureProduct(product) {
  const existing = await prisma.product.findUnique({
    where: { slug: product.slug },
    select: { id: true, slug: true },
  });

  if (existing) return { product: existing, created: false };

  const created = await prisma.product.create({
    data: product,
    select: { id: true, slug: true },
  });

  return { product: created, created: true };
}

async function ensurePage({ url, title, content, imagePath, userId }) {
  const existing = await prisma.page.findUnique({ where: { url } });
  if (existing) return { page: existing, created: false };

  const created = await prisma.page.create({
    data: {
      userId,
      title,
      url,
      content,
      imagePath,
    },
  });

  return { page: created, created: true };
}

async function ensureNavigationItem({ userId, parentId = null, title, url, order = 0, isActive = true }) {
  const existing = await prisma.navigation.findFirst({
    where: {
      parentId,
      url,
      isActive: true,
    },
    select: { id: true },
  });

  if (existing) return { id: existing.id, created: false };

  const created = await prisma.navigation.create({
    data: {
      userId,
      parentId,
      title,
      url,
      order,
      isActive,
    },
    select: { id: true },
  });

  return { id: created.id, created: true };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Pass123";
  const customerPassword = process.env.SEED_CUSTOMER_PASSWORD || "Pass123";

  const { user: adminUser, created: adminCreated } = await ensureUser({
    email: "admin@example.com",
    password: adminPassword,
    role: "admin",
    name: "Admin User",
  });

  const { user: customerUser, created: customerCreated } = await ensureUser({
    email: "user@example.com",
    password: customerPassword,
    role: "customer",
    name: "Test User",
  });

  const durationAttr = await ensureAttribute("Duration");
  const locationAttr = await ensureAttribute("Location");

  await ensureNavigationItem({
    userId: adminUser.id,
    title: "Home",
    url: "/",
    order: 1,
    isActive: true,
  });

  await ensureNavigationItem({
    userId: adminUser.id,
    title: "Shop",
    url: "/shop",
    order: 2,
    isActive: true,
  });

  const products = [
    {
      name: "Back Massage",
      slug: "back-massage",
      description: "One-hour classic massage session.",
      basePrice: "180.00",
      vat: "23.00",
      imagePath: "/images/products/product-default.jpg",
    },
    {
      name: "Photography Course",
      slug: "photography-course",
      description: "Learn the basics of photography.",
      basePrice: "299.00",
      vat: "23.00",
      imagePath: "/images/products/product-default.jpg",
    },
    {
      name: "Tandem Skydiving",
      slug: "tandem-skydiving",
      description: "A tandem skydive with an experienced instructor.",
      basePrice: "1200.00",
      vat: "23.00",
      imagePath: "/images/products/product-default.jpg",
    },
    {
      name: "Dinner for Two",
      slug: "dinner-for-two",
      description: "A tasting dinner for two.",
      basePrice: "450.00",
      vat: "23.00",
      imagePath: "/images/products/product-default.jpg",
    },
    {
      name: "Guitar Lesson",
      slug: "guitar-lesson",
      description: "A one-on-one lesson with a guitar teacher.",
      basePrice: "90.00",
      vat: "23.00",
      imagePath: "/images/products/product-default.jpg",
    },
  ];

  const ensuredProducts = [];
  let productsCreated = 0;
  for (const product of products) {
    // eslint-disable-next-line no-await-in-loop
    const result = await ensureProduct(product);
    ensuredProducts.push(result.product);
    if (result.created) productsCreated += 1;
  }

  const productBySlug = Object.fromEntries(ensuredProducts.map((p) => [p.slug, p]));

  const attributeValues = [
    { slug: "back-massage", attributeId: durationAttr.id, value: "60 min" },
    { slug: "back-massage", attributeId: durationAttr.id, value: "90 min" },
    { slug: "tandem-skydiving", attributeId: locationAttr.id, value: "Poznań" },
    { slug: "tandem-skydiving", attributeId: locationAttr.id, value: "Warsaw" },
    { slug: "dinner-for-two", attributeId: durationAttr.id, value: "2 hours" },
  ];

  let attributeValuesCreated = 0;
  for (const item of attributeValues) {
    const product = productBySlug[item.slug];
    if (!product) continue;

    // eslint-disable-next-line no-await-in-loop
    const result = await ensureAttributeValue({
      productId: product.id,
      attributeId: item.attributeId,
      value: item.value,
    });

    if (result.created) attributeValuesCreated += 1;
  }

  await ensurePage({
    userId: adminUser.id,
    title: "About Us",
    url: "about",
    content: "Learn more about our company and the team behind it.",
    imagePath: "/images/pages/page-default.jpg",
  });

  await ensurePage({
    userId: adminUser.id,
    title: "Contact",
    url: "contact",
    content: "Contact details and a simple contact form.",
    imagePath: "/images/pages/page-default.jpg",
  });

  console.log("Seed completed.");
  console.log({
    users: {
      admin: { email: adminUser.email, created: adminCreated },
      customer: { email: customerUser.email, created: customerCreated },
    },
    productsCreated,
    attributeValuesCreated,
  });
}

main()
  .catch((error) => {
    const message = error && error.message ? error.message : String(error);

    if (error && error.code === "P2002") {
      console.error("Unique constraint violation.");
      process.exitCode = 2;
    } else {
      console.error(message);
      process.exitCode = 1;
    }
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
