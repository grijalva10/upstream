import { z } from "zod";

export const campaignStatusSchema = z.enum(["draft", "active", "paused", "completed"]);
export const enrollmentStatusSchema = z.enum(["pending", "active", "replied", "completed", "stopped"]);

export const campaignIdSchema = z.object({
  id: z.string().uuid("Invalid campaign ID"),
});

export const listCampaignsSchema = z.object({
  status: campaignStatusSchema.optional(),
});

export const createCampaignSchema = z.object({
  search_id: z.string().uuid("Invalid search ID"),
  name: z
    .string()
    .min(1, "Name is required")
    .max(200, "Name must be less than 200 characters"),
});

export const updateCampaignSchema = z.object({
  status: campaignStatusSchema.optional(),
  name: z.string().min(1).max(200).optional(),
  email_1_subject: z.string().optional(),
  email_1_body: z.string().optional(),
  email_2_subject: z.string().optional(),
  email_2_body: z.string().optional(),
  email_2_delay_days: z.number().min(1).max(30).optional(),
  email_3_subject: z.string().optional(),
  email_3_body: z.string().optional(),
  email_3_delay_days: z.number().min(1).max(30).optional(),
  send_window_start: z.string().optional(),
  send_window_end: z.string().optional(),
  timezone: z.string().optional(),
});

export const listEnrollmentsSchema = z.object({
  status: enrollmentStatusSchema.optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type ListEnrollmentsInput = z.infer<typeof listEnrollmentsSchema>;

export function formatZodError(error: z.ZodError<unknown>): string {
  return error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
}
