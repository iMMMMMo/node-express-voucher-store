require("dotenv").config();

const bcrypt = require("bcrypt");
const prisma = require("../prisma/prismaClient");

function printHelp() {
  console.log(`\
Usage:
  npm run edit-user -- --email <existing email> [--new-email <email>] [--password <password>] [--role <admin|customer>] [--name <full name>] [--phone <phone>] [--clear-phone]

Examples:
  npm run edit-user -- --email user@example.com --role admin
  npm run edit-user -- --email user@example.com --password "NewPass123"
  npm run edit-user -- --email user@example.com --name "Jan Kowalski" --phone "+48 123 456 789"
  npm run edit-user -- --email user@example.com --clear-phone
  npm run edit-user -- --email old@example.com --new-email new@example.com

Alternative:
  node scripts/edit-user.js --email user@example.com --role admin

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
  if (!role) return undefined;
  const normalized = String(role).trim().toLowerCase();
  if (normalized !== "admin" && normalized !== "customer") {
    throw new Error(`Invalid --role: ${role}. Allowed: admin, customer`);
  }
  return normalized;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const email = typeof args.email === "string" ? args.email.trim().toLowerCase() : "";
  if (!email) throw new Error("Missing required --email (existing email)");

  const newEmail =
    typeof args["new-email"] === "string" ? args["new-email"].trim().toLowerCase() : undefined;
  const password = typeof args.password === "string" ? args.password : undefined;
  const role = normalizeRole(args.role);
  const name = typeof args.name === "string" ? args.name.trim() : undefined;
  const phone = typeof args.phone === "string" ? args.phone.trim() : undefined;
  const clearPhone = Boolean(args["clear-phone"]);

  if (typeof password === "string" && password.length < 6) {
    throw new Error("Password must be at least 6 characters long");
  }

  if (clearPhone && typeof phone === "string") {
    throw new Error("Use either --phone or --clear-phone (not both)");
  }

  const data = {};

  if (typeof newEmail === "string" && newEmail.length > 0) data.email = newEmail;
  if (typeof role === "string") data.role = role;
  if (typeof name === "string") {
    if (name.length < 2) throw new Error("Name must be at least 2 characters long");
    data.name = name;
  }
  if (clearPhone) data.phone = null;
  if (typeof phone === "string") data.phone = phone === "" ? null : phone;

  if (typeof password === "string" && password.length > 0) {
    data.password = await bcrypt.hash(password, 10);
  }

  if (Object.keys(data).length === 0) {
    throw new Error(
      "Nothing to update. Provide at least one of: --new-email, --password, --role, --name, --phone, --clear-phone",
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true },
  });

  if (!existing) {
    console.error(`User not found: ${email}`);
    process.exit(2);
  }

  const updated = await prisma.user.update({
    where: { email },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      createdAt: true,
    },
  });

  console.log("Updated user:");
  console.log(updated);
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
