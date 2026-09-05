import "dotenv/config";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local for Next.js-style local secrets
config({ path: resolve(process.cwd(), ".env.local") });
config(); // also .env if present

async function main() {
  // Dynamic import after env is loaded so prisma client sees DATABASE_URL
  const { wipeAndSeedDemoWorkspace } = await import("../lib/seed-demo");
  const result = await wipeAndSeedDemoWorkspace();
  console.log("Seeded demo workspace:", result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../lib/prisma");
    await prisma.$disconnect();
  });
