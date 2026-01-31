import * as fs from 'fs';
import * as path from 'path';

// Cache to store the resolved workspace root for a given directory path.
// Key: Directory path
// Value: The resolved workspace root path
const rootCache = new Map<string, string>();

/**
 * Finds the KRC workspace root for a given directory asynchronously.
 * It caches the result to avoid redundant file system operations.
 */
export async function findWorkspaceRoot(startDir: string): Promise<string> {
    // Normalize path just in case
    let currentDir = path.normalize(startDir);

    // Check if we already know the answer for this dir
    if (rootCache.has(currentDir)) {
        return rootCache.get(currentDir)!;
    }

    // To do this efficiently, we'll collect the path we traverse.
    const visited: string[] = [];

    let foundRoot: string | null = null;
    let traceDir = currentDir;

    // Traverse up
    while (traceDir.length > 1) {
        // Optimization: If we hit a cached directory, we use its result
        if (rootCache.has(traceDir)) {
            foundRoot = rootCache.get(traceDir)!;
            break;
        }

        visited.push(traceDir);

        try {
            // Check for KRC structure
            // We use Promise.all to run checks in parallel
            const [hasKRC, hasR1] = await Promise.all([
                fileExists(path.join(traceDir, "KRC")),
                fileExists(path.join(traceDir, "R1"))
            ]);

            // Also check directory name (synchronous string check)
            const isKRCFolder = path.basename(traceDir).toUpperCase() === "KRC";

            if (hasKRC || hasR1 || isKRCFolder) {
                foundRoot = traceDir;
                break;
            }
        } catch (e) {
            // Error reading FS (e.g. permission), assume not root
        }

        const parent = path.dirname(traceDir);
        if (parent === traceDir) break; // Reached root
        traceDir = parent;
    }

    // If foundRoot is null, it means we reached system root without finding anything.
    // In that case, the original logic set state.workspaceRoot to system root (traceDir).
    const result = foundRoot || traceDir;

    // Update cache for all visited directories
    for (const dir of visited) {
        rootCache.set(dir, result);
    }

    // Also cache the startDir if it wasn't in visited (e.g. if loop didn't run)
    if (!rootCache.has(startDir)) {
        rootCache.set(startDir, result);
    }

    return result;
}

/**
 * Helper to check if file/dir exists asynchronously
 */
async function fileExists(path: string): Promise<boolean> {
    try {
        await fs.promises.access(path);
        return true;
    } catch {
        return false;
    }
}

/**
 * Clear the workspace root cache.
 * Useful if the workspace structure changes significantly.
 */
export function clearWorkspaceRootCache() {
    rootCache.clear();
}
