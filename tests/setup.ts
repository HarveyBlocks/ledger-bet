import { afterAll, beforeAll, beforeEach } from "vitest";

import { ensureTestSchema, resetTestDatabase, testPrisma } from "./helpers/db";

beforeAll(async () => {
  ensureTestSchema();
  await resetTestDatabase();
});

beforeEach(async () => {
  await resetTestDatabase();
});

afterAll(async () => {
  await testPrisma.$disconnect();
});
