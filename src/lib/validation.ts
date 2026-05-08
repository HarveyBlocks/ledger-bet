import { ZodError, z } from "zod";

import { ValidationError } from "@/lib/errors";

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
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      const message = error.issues[0]?.message ?? "Invalid request payload";
      throw new ValidationError(message, "INVALID_REQUEST_BODY");
    }

    throw error;
  }
}

export function parsePositiveInt(value: string, fieldName: string) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ValidationError(`${fieldName} must be a positive integer`, "INVALID_INTEGER");
  }

  return parsed;
}
