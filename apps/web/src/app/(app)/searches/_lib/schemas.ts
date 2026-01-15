import { z } from "zod";

export const searchSourceSchema = z.enum(["lee-1031-x", "manual", "inbound"]);

export const searchStatusSchema = z.enum([
  "draft",
  "pending_queries",
  "generating_queries",
  "extracting",
  "ready",
  "failed",
  "campaign_created",
]);

export const createSearchSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(200, "Name must be less than 200 characters"),
  source: searchSourceSchema.default("manual"),
  criteria_json: z
    .record(z.string(), z.unknown())
    .optional(),
});

export type CreateSearchInput = z.infer<typeof createSearchSchema>;

export const searchIdSchema = z.object({
  id: z.string().uuid("Invalid search ID"),
});

export const listSearchesSchema = z.object({
  status: searchStatusSchema.optional(),
});

export function formatZodError(error: z.ZodError<unknown>): string {
  return error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
}
