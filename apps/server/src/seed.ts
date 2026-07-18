import { prisma } from "./lib/prisma.js";
import { runSeed } from "./lib/seedData.js";

runSeed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
