import * as fs from "fs";
import * as path from "path";

/**
 * Bir dizinde belirli uzantılara sahip tüm dosyaları özyinelemeli olarak bulur.
 */
export async function findFilesByExtension(
  dir: string,
  extensions: string[],
): Promise<string[]> {
  let results: string[] = [];
  try {
    const list = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of list) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // node_modules ve benzeri dizinleri atla
        if (entry.name === "node_modules" || entry.name.startsWith(".")) {
          continue;
        }
        const subFiles = await findFilesByExtension(fullPath, extensions);
        results = results.concat(subFiles);
      } else if (entry.isFile()) {
        if (
          extensions.some((ext) =>
            entry.name.toLowerCase().endsWith(ext.toLowerCase()),
          )
        ) {
          results.push(fullPath);
        }
      }
    }
  } catch (error) {
    // Dizin okuma hatası sessizce yoksayılır
    // console.error(`Dizin okuma hatası ${dir}:`, error);
  }
  return results;
}

/**
 * Tüm .dat dosyalarını özyinelemeli olarak bulur.
 */
export async function getAllDatFiles(dir: string): Promise<string[]> {
  return findFilesByExtension(dir, [".dat"]);
}

/**
 * Tüm kaynak dosyalarını (.src, .dat, .sub) özyinelemeli olarak bulur.
 */
export async function getAllSourceFiles(dir: string): Promise<string[]> {
  return findFilesByExtension(dir, [".src", ".dat", ".sub"]);
}
