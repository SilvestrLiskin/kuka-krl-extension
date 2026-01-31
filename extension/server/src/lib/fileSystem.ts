import * as fs from "fs";
import * as path from "path";

/**
 * Рекурсивно находит все файлы с заданными расширениями в указанной директории.
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
        // Пропускаем node_modules и скрытые папки
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
  } catch {
    // Ошибки чтения директории игнорируются
  }
  return results;
}

/**
 * Находит все .dat файлы в директории.
 */
export async function getAllDatFiles(dir: string): Promise<string[]> {
  return findFilesByExtension(dir, [".dat"]);
}

/**
 * Находит все исходные файлы KRL (.src, .dat, .sub).
 */
export async function getAllSourceFiles(dir: string): Promise<string[]> {
  return findFilesByExtension(dir, [".src", ".dat", ".sub"]);
}
