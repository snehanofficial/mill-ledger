import { auth } from "../src/lib/auth.js";
import { prisma } from "../src/db/client.js";
import type { Role } from "@mill-ledger/shared";

interface SeedUser {
  name: string;
  email: string;
  password: string;
  role: Role;
}

const SEED_USERS: SeedUser[] = [
  {
    name: "Mill Admin",
    email: "admin@millledger.local",
    password: "AdminPassword123!",
    role: "ADMIN",
  },
  {
    name: "Salesman One",
    email: "salesman1@millledger.local",
    password: "SalesmanPassword123!",
    role: "SALESMAN",
  },
  {
    name: "Salesman Two",
    email: "salesman2@millledger.local",
    password: "SalesmanPassword123!",
    role: "SALESMAN",
  },
  {
    name: "Production Manager",
    email: "production@millledger.local",
    password: "ProductionPassword123!",
    role: "PRODUCTION",
  },
  {
    name: "Auditor Accountant",
    email: "accountant@millledger.local",
    password: "AccountantPassword123!",
    role: "ACCOUNTANT",
  },
  {
    name: "Mill Owner",
    email: "owner@millledger.local",
    password: "OwnerPassword123!",
    role: "OWNER",
  },
];

export async function seedUsers() {
  console.log("Seeding test users for M1...");

  for (const user of SEED_USERS) {
    const existing = await prisma.user.findUnique({
      where: { email: user.email },
    });

    if (existing) {
      console.log(`User ${user.email} already exists, updating role to ${user.role}...`);
      await prisma.user.update({
        where: { email: user.email },
        data: {
          role: user.role,
          name: user.name,
          isActive: true,
        },
      });
      continue;
    }

    // Register via Better Auth email and password API
    await auth.api.signUpEmail({
      body: {
        email: user.email,
        password: user.password,
        name: user.name,
      },
    });

    // Ensure role and active status are explicitly set
    await prisma.user.update({
      where: { email: user.email },
      data: {
        role: user.role,
        isActive: true,
      },
    });

    console.log(`Created user ${user.email} with role ${user.role}`);
  }

  console.log("M1 test users successfully seeded.");
}

// Execute when invoked directly
if (process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.js")) {
  seedUsers()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error("Failed to seed database:", error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
