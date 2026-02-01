/* eslint-disable no-console */

require("dotenv").config();

const bcrypt = require("bcrypt");
const prisma = require("../prisma/prismaClient");

function printHelp() {
  console.log(`\
Usage:
  npm run create-user -- --email <email> --password <password> --role <admin|customer> [--name <full name>] [--phone <phone>]

Examples:
  npm run create-user -- --email admin@example.com --password "Pass123" --role admin
  npm run create-user -- --email user@example.com --password "Pass123" --role customer --name "Jan Kowalski"

Alternative:
  node scripts/create-user.js --email admin@example.com --password "Pass123" --role admin

Notes:
  - Requires DATABASE_URL in environment (.env supported)
  - Password must be at least 6 characters long
  - Role must be: admin or customer
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

function normalizeRole(role) {
  if (!role) return "customer";
  const normalized = String(role).trim().toLowerCase();
  if (normalized !== "admin" && normalized !== "customer") {
    throw new Error(`Invalid --role: ${role}. Allowed: admin, customer`);
  }
  return normalized;
}

function defaultNameFromEmail(email) {
  const localPart = String(email).split("@")[0] || "User";
  const cleaned = localPart.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "User";
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const email = typeof args.email === "string" ? args.email.trim().toLowerCase() : "";
  const password = typeof args.password === "string" ? args.password : "";
  const role = normalizeRole(args.role);
  const name = typeof args.name === "string" ? args.name.trim() : defaultNameFromEmail(email);
  const phone = typeof args.phone === "string" ? args.phone.trim() : null;

  if (!email) throw new Error("Missing required --email");
  if (!password) throw new Error("Missing required --password");
  if (password.length < 6) throw new Error("Password must be at least 6 characters long");
  if (!name || name.length < 2) throw new Error("Name must be at least 2 characters long (provide --name if needed)");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.error(`User already exists: ${email} (id=${existing.id}, role=${existing.role})`);
    process.exit(2);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const created = await prisma.user.create({
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

  console.log("Created user:");
  console.log(created);
}

main()
  .catch((error) => {
    const message = error && error.message ? error.message : String(error);

    if (error && error.code === "P2002") {
      console.error("Unique constraint violation (likely email already exists).");
      process.exitCode = 2;
    } else {
      console.error(message);
      process.exitCode = 1;
    }
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
