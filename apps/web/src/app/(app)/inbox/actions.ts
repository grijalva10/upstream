"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function completeTask(taskId: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("tasks")
    .update({ status: "completed" })
    .eq("id", taskId);

  if (error) {
    console.error("Failed to complete task:", error);
    throw new Error("Failed to complete task");
  }

  revalidatePath("/inbox");
}

export async function snoozeTask(taskId: string, days: number): Promise<void> {
  const supabase = createAdminClient();

  // Get current task
  const { data: task, error: fetchError } = await supabase
    .from("tasks")
    .select("due_date")
    .eq("id", taskId)
    .single();

  if (fetchError || !task) {
    console.error("Failed to fetch task:", fetchError);
    throw new Error("Failed to fetch task");
  }

  // Calculate new due date
  const currentDate = new Date(task.due_date);
  currentDate.setDate(currentDate.getDate() + days);
  const newDueDate = currentDate.toISOString().split("T")[0];

  const { error } = await supabase
    .from("tasks")
    .update({ due_date: newDueDate, status: "snoozed" })
    .eq("id", taskId);

  if (error) {
    console.error("Failed to snooze task:", error);
    throw new Error("Failed to snooze task");
  }

  revalidatePath("/inbox");
}
