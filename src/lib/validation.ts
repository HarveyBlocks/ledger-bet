import { z } from "zod";

const positiveInteger = z.coerce
  .number()
  .int("amount must be an integer")
  .positive("amount must be positive");

export const depositSchema = z.object({
  amount: positiveInteger,
});

export const betSchema = z.object({
  userId: z.number().int().positive(),
  gameId: z.string().trim().min(1, "gameId is required"),
  amount: positiveInteger,
});

export const settleSchema = z.object({
  result: z.enum(["WIN", "LOSE"]),
});

export function parseJson<T>(schema: z.ZodSchema<T>, input: unknown): T {
  return schema.parse(input);
}
