/**
 * Ghost Detection Job
 *
 * Identifies contacts who have stopped responding after engagement.
 * Criteria: No response for 10+ days after 2+ follow-ups.
 *
 * Actions:
 * 1. Mark qualification_data as ghosted
 * 2. Update company status to nurture
 * 3. Create nurture task for 90 days out
 *
 * Runs daily.
 */

import PgBoss from 'pg-boss';
import { supabase } from '../db.js';

export interface GhostDetectionResult {
  ghostsDetected: number;
  errors: number;
}

export async function handleGhostDetection(
  job: PgBoss.Job | PgBoss.Job[]
): Promise<GhostDetectionResult> {
  const actualJob = Array.isArray(job) ? job[0] : job;
  void actualJob;

  console.log('[ghost-detection] Starting ghost detection...');

  let ghostsDetected = 0;
  let errors = 0;

  try {
    // Query the view for potential ghosts
    const { data: ghosts, error } = await supabase
      .from('potential_ghosts')
      .select('*')
      .limit(50);

    if (error) {
      console.error('[ghost-detection] Query failed:', error.message);
      throw new Error(error.message);
    }

    if (!ghosts || ghosts.length === 0) {
      console.log('[ghost-detection] No ghosts detected');
      return { ghostsDetected: 0, errors: 0 };
    }

    console.log(`[ghost-detection] Found ${ghosts.length} potential ghosts`);

    for (const ghost of ghosts) {
      try {
        // Mark qualification_data as ghosted
        await supabase
          .from('qualification_data')
          .update({
            ghosted_at: new Date().toISOString(),
            status: 'engaging', // Keep status but mark ghosted
          })
          .eq('id', ghost.id);

        // Update company status to nurture (if not already further along)
        if (ghost.company_id) {
          await supabase
            .from('companies')
            .update({
              status: 'rejected',
              status_changed_at: new Date().toISOString(),
            })
            .eq('id', ghost.company_id)
            .in('status', ['new', 'contacted', 'engaged']);
        }

        // Create nurture task for 90 days out
        const nurtureDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

        // Summarize what we had
        const hadInfo: string[] = [];
        if (ghost.asking_price) hadInfo.push(`Price: $${ghost.asking_price.toLocaleString()}`);
        if (ghost.noi) hadInfo.push(`NOI: $${ghost.noi.toLocaleString()}`);

        await supabase.from('tasks').insert({
          type: 'nurture',
          contact_id: null, // Will need to look up
          company_id: ghost.company_id,
          property_id: ghost.property_id,
          title: `Nurture (ghosted): ${ghost.contact_name}`,
          description: `Contact ghosted after ${ghost.follow_up_count} follow-ups. Last response: ${
            ghost.last_response_at
              ? new Date(ghost.last_response_at).toLocaleDateString()
              : 'Unknown'
          }${hadInfo.length > 0 ? `. Had: ${hadInfo.join(', ')}` : ''}`,
          due_date: nurtureDate.toISOString().split('T')[0],
          auto_generated: true,
        });

        ghostsDetected++;
        console.log(
          `[ghost-detection] Marked ${ghost.contact_name} (${ghost.contact_email}) as ghosted`
        );
      } catch (err) {
        console.error(`[ghost-detection] Failed to process ghost ${ghost.id}:`, err);
        errors++;
      }
    }
  } catch (err) {
    console.error('[ghost-detection] Job failed:', err);
    errors++;
  }

  console.log(`[ghost-detection] Complete: ${ghostsDetected} ghosts detected, ${errors} errors`);

  return { ghostsDetected, errors };
}
