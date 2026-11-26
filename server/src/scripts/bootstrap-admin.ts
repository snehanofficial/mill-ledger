import readline from "node:readline";
import { Writable } from "node:stream";
import { prisma } from "../db/client.js";
import { auth } from "../lib/auth.js";
import { auditService } from "../modules/reporting/audit.service.js";

function ask(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function askHidden(query: string): Promise<string> {
  if (!process.stdin.isTTY) {
    return ask(query);
  }

  return new Promise((resolve) => {
    let muted = false;
    const mutableStdout = new Writable({
      write(chunk, encoding, callback) {
        if (!muted) {
          process.stdout.write(chunk, encoding);
        }
        callback();
      },
    });

    const rl = readline.createInterface({
      input: process.stdin,
      output: mutableStdout,
      terminal: true,
    });

    process.stdout.write(query);
    muted = true;

    rl.question("", (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

export async function bootstrapAdmin() {
  console.log("==========================================");
  console.log("   MillLedger Administrator Bootstrap     ");
  console.log("==========================================");

  // Safeguard: Check if an active administrator already exists
  const existingAdmin = await prisma.user.findFirst({
    where: {
      role: "ADMIN",
      isActive: true,
    },
  });

  if (existingAdmin) {
    console.error("Initial administrator already exists. Bootstrap aborted.");
    if (process.env.NODE_ENV !== "test") {
      process.exit(1);
    }
    return { success: false, reason: "ADMIN_ALREADY_EXISTS" };
  }

  // Get credentials from environment or interactive prompt
  let name = process.env.BOOTSTRAP_ADMIN_NAME;
  let email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  let password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!email || !password) {
    name = await ask("Administrator Full Name [Initial Administrator]: ");
    if (!name) name = "Initial Administrator";

    email = await ask("Administrator Email: ");
    if (!email || !email.includes("@")) {
      console.error("Invalid email address provided.");
      process.exit(1);
    }

    password = await askHidden("Administrator Password (min 8 chars): ");
    if (!password || password.length < 8) {
      console.error("Password must be at least 8 characters long.");
      process.exit(1);
    }

    const confirmPassword = await askHidden("Confirm Password: ");
    if (password !== confirmPassword) {
      console.error("Passwords do not match. Bootstrap aborted.");
      process.exit(1);
    }
  } else {
    if (!name) name = "Initial Administrator";
  }

  // Validate format
  const cleanEmail = email.toLowerCase().trim();
  if (!cleanEmail.includes("@") || !cleanEmail.includes(".")) {
    console.error("Invalid email format.");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Password must be at least 8 characters long.");
    process.exit(1);
  }

  // Ensure organization exists
  const org = await prisma.organization.upsert({
    where: { code: "MILL" },
    update: {},
    create: {
      code: "MILL",
      name: "MillLedger Foods Pvt Ltd",
      state: "Tamil Nadu",
      gstin: "33AABCM1234F1Z1",
    },
  });

  // Provision admin account via Better Auth
  await auth.api.signUpEmail({
    body: {
      email: cleanEmail,
      password,
      name,
    },
  });

  const adminUser = await prisma.user.update({
    where: { email: cleanEmail },
    data: {
      role: "ADMIN",
      isActive: true,
      organizationId: org.id,
    },
  });

  // Emit transactional audit log
  await auditService.log({
    organizationId: org.id,
    userId: adminUser.id,
    userEmail: adminUser.email,
    action: "ADMIN_BOOTSTRAP",
    entity: "User",
    entityId: adminUser.id,
    details: { email: adminUser.email, role: adminUser.role },
    reason: "Initial administrator bootstrapped via admin:bootstrap CLI",
  });

  console.log(`Admin bootstrap completed successfully for: ${adminUser.email}`);
  return { success: true, email: adminUser.email };
}

// Execute when invoked directly
if (
  process.argv[1]?.endsWith("bootstrap-admin.ts") ||
  process.argv[1]?.endsWith("bootstrap-admin.js")
) {
  bootstrapAdmin()
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error("Bootstrap failed:", err.message || err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
