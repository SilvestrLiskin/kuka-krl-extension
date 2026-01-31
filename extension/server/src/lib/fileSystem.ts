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
  } catch {
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

/**
 * Çalışma alanı kökünü bulmak için yukarı doğru arama yapar (Asenkron).
 * "KRC" veya "R1" dizinlerini veya adı "KRC" olan bir dizini arar.
 */
export async function findWorkspaceRoot(startDir: string): Promise<string> {
  let currentDir = startDir;
  while (currentDir.length > 1) {
    // 1. İsim kontrolü (En hızlısı, I/O gerektirmez)
    if (path.basename(currentDir).toUpperCase() === "KRC") {
      return currentDir;
    }

    // 2. Dizin kontrolü (Paralel ve asenkron)
    try {
      const [hasKrc, hasR1] = await Promise.all([
        fs.promises
          .access(path.join(currentDir, "KRC"))
          .then(() => true)
          .catch(() => false),
        fs.promises
          .access(path.join(currentDir, "R1"))
          .then(() => true)
          .catch(() => false),
      ]);

      if (hasKrc || hasR1) {
        return currentDir;
      }
    } catch {
      // Hata durumunda devam et
    }

    const parent = path.dirname(currentDir);
    if (parent === currentDir) break;
    currentDir = parent;
  }
  return currentDir;
}
