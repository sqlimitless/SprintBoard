import {
  extractAttachmentUrls,
  sweepOrphanAttachments,
} from "../attachments";
import { orm } from "./connection";
import { issues, projects } from "./schema";

/**
 * Delete attachment files on disk that aren't referenced by any project or
 * issue description. Includes soft-deleted rows so restoring from Trash works.
 * Call once on app startup.
 */
export async function runAttachmentSweep(): Promise<number> {
  const used = new Set<string>();
  try {
    const pRows = await orm
      .select({ description: projects.description })
      .from(projects);
    for (const r of pRows) {
      for (const u of extractAttachmentUrls(r.description ?? "")) used.add(u);
    }
    const iRows = await orm
      .select({ description: issues.description })
      .from(issues);
    for (const r of iRows) {
      for (const u of extractAttachmentUrls(r.description ?? "")) used.add(u);
    }
  } catch (err) {
    console.warn("runAttachmentSweep: collect used urls failed", err);
    return 0;
  }
  return sweepOrphanAttachments(used);
}
