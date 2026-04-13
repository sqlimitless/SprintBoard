import { convertFileSrc } from "@tauri-apps/api/core";
import {
  BaseDirectory,
  exists,
  mkdir,
  readDir,
  remove,
  writeFile,
} from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";

const DIR = "attachments";

async function ensureDir(sub?: string): Promise<string> {
  const rel = sub ? `${DIR}/${sub}` : DIR;
  if (!(await exists(rel, { baseDir: BaseDirectory.AppData }))) {
    await mkdir(rel, {
      baseDir: BaseDirectory.AppData,
      recursive: true,
    });
  }
  return rel;
}

function extFromMime(mime: string): string {
  const m: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/avif": "avif",
  };
  return m[mime] ?? "bin";
}

/**
 * Save a Blob/File to the app-data attachments directory.
 * Returns a URL that can be placed directly into an `<img src>` and markdown.
 */
export async function saveImage(
  blob: Blob,
  opts: { projectId?: string; filename?: string } = {},
): Promise<{ url: string; absPath: string; relPath: string }> {
  const scope = opts.projectId ?? "misc";
  await ensureDir(scope);

  const ext = opts.filename?.split(".").pop()?.toLowerCase() || extFromMime(blob.type);
  const uuid = crypto.randomUUID();
  const relPath = `${DIR}/${scope}/${uuid}.${ext}`;

  const buf = new Uint8Array(await blob.arrayBuffer());
  await writeFile(relPath, buf, { baseDir: BaseDirectory.AppData });

  const base = await appDataDir();
  const absPath = await join(base, relPath);
  const url = convertFileSrc(absPath);
  return { url, absPath, relPath };
}

/** Extract asset URLs used by img tags / markdown image syntax from content. */
export function extractAttachmentUrls(markdown: string): string[] {
  const out = new Set<string>();
  // Markdown: ![alt](url)
  for (const m of markdown.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
    out.add(m[1]);
  }
  // HTML img src="url"
  for (const m of markdown.matchAll(/<img[^>]+src=["']([^"']+)["']/g)) {
    out.add(m[1]);
  }
  return [...out];
}

/** Best-effort conversion of a tauri asset URL back to an app-data-relative path. */
export function urlToRelPath(url: string): string | null {
  try {
    // Match anywhere in the URL to handle file://, http://asset.localhost, etc.
    const m = url.match(/\/attachments\/[^?#]+/);
    if (!m) return null;
    return decodeURIComponent(m[0].replace(/^\//, ""));
  } catch {
    return null;
  }
}

export async function deleteAttachmentByUrl(url: string): Promise<void> {
  const rel = urlToRelPath(url);
  if (!rel) return;
  try {
    if (await exists(rel, { baseDir: BaseDirectory.AppData })) {
      await remove(rel, { baseDir: BaseDirectory.AppData });
    }
  } catch (err) {
    console.warn("deleteAttachmentByUrl failed:", url, err);
  }
}

/**
 * Remove every attachment file under `attachments/<scope>/`.
 * Used when purging a project (scope = projectId) or for one-off cleanup.
 */
/**
 * Compare two markdown bodies and delete attachments that were present before
 * but have been removed. Safe to call on every save — no-ops when there are no
 * differences.
 */
export async function cleanupRemovedAttachments(
  beforeMarkdown: string,
  afterMarkdown: string,
): Promise<void> {
  const before = new Set(extractAttachmentUrls(beforeMarkdown));
  const after = new Set(extractAttachmentUrls(afterMarkdown));
  for (const url of before) {
    if (!after.has(url)) await deleteAttachmentByUrl(url);
  }
}

/**
 * Remove attachment files on disk that no longer appear in any description —
 * covers aborted creates (image pasted but form cancelled) and stray files.
 * `usedUrls` should contain every URL from every project/issue description
 * (including soft-deleted rows so restore stays safe).
 */
export async function sweepOrphanAttachments(
  usedUrls: Iterable<string>,
): Promise<number> {
  const referencedPaths = new Set<string>();
  for (const u of usedUrls) {
    const p = urlToRelPath(u);
    if (p) referencedPaths.add(p);
  }

  let removed = 0;
  try {
    if (!(await exists(DIR, { baseDir: BaseDirectory.AppData }))) return 0;
    const scopeEntries = await readDir(DIR, { baseDir: BaseDirectory.AppData });
    for (const scope of scopeEntries) {
      if (!scope.isDirectory) continue;
      const scopePath = `${DIR}/${scope.name}`;
      const files = await readDir(scopePath, {
        baseDir: BaseDirectory.AppData,
      });
      for (const f of files) {
        if (!f.isFile) continue;
        const rel = `${scopePath}/${f.name}`;
        if (!referencedPaths.has(rel)) {
          try {
            await remove(rel, { baseDir: BaseDirectory.AppData });
            removed++;
          } catch (err) {
            console.warn("sweep remove failed:", rel, err);
          }
        }
      }
    }
  } catch (err) {
    console.warn("sweepOrphanAttachments failed:", err);
  }
  return removed;
}

export async function deleteAttachmentsByScope(scope: string): Promise<void> {
  const rel = `${DIR}/${scope}`;
  try {
    if (!(await exists(rel, { baseDir: BaseDirectory.AppData }))) return;
    const entries = await readDir(rel, { baseDir: BaseDirectory.AppData });
    for (const e of entries) {
      if (e.isFile) {
        await remove(`${rel}/${e.name}`, {
          baseDir: BaseDirectory.AppData,
        });
      }
    }
    await remove(rel, { baseDir: BaseDirectory.AppData });
  } catch (err) {
    console.warn("deleteAttachmentsByScope failed:", scope, err);
  }
}
