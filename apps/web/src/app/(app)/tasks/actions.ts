"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function completeTask(taskId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("tasks")
    .update({
      completed_at: new Date().toISOString(),
      status: "completed",
    })
    .eq("id", taskId);

  if (error) {
    console.error("Error completing task:", error);
    throw new Error("Failed to complete task");
  }

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function uncompleteTask(taskId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("tasks")
    .update({
      completed_at: null,
      status: "pending",
    })
    .eq("id", taskId);

  if (error) {
    console.error("Error uncompleting task:", error);
    throw new Error("Failed to uncomplete task");
  }

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function rescheduleTask(taskId: string, newDate: string, newTime?: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("tasks")
    .update({
      due_date: newDate,
      due_time: newTime || null,
    })
    .eq("id", taskId);

  if (error) {
    console.error("Error rescheduling task:", error);
    throw new Error("Failed to reschedule task");
  }

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}
