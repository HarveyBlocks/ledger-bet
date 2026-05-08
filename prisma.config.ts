import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: `file:${path.resolve(process.cwd(), "prisma/dev.db").replace(/\\/g, "/")}`,
  },
});
