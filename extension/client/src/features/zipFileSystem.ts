import * as vscode from "vscode";
import * as AdmZip from "adm-zip";
// path import removed - not used in this file

export class ZipFileSystemProvider implements vscode.FileSystemProvider {
  private _onDidChangeFile = new vscode.EventEmitter<
    vscode.FileChangeEvent[]
  >();
  readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> =
    this._onDidChangeFile.event;

  private zips: Map<string, AdmZip> = new Map();

  watch(
    _uri: vscode.Uri,
    _options: { recursive: boolean; excludes: string[] },
  ): vscode.Disposable {
    return new vscode.Disposable(() => {});
  }

  stat(uri: vscode.Uri): vscode.FileStat {
    const { zipPath, entryPath } = this.parseUri(uri);
    const zip = this.getZip(zipPath);

    if (entryPath === "/" || entryPath === "") {
      return { type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 };
    }

    // Clean entry path (remove leading slash)
    const cleanEntryPath = entryPath.startsWith("/")
      ? entryPath.substring(1)
      : entryPath;
    const entry = zip.getEntry(cleanEntryPath);

    if (entry) {
      return {
        type: entry.isDirectory
          ? vscode.FileType.Directory
          : vscode.FileType.File,
        ctime: entry.header.time.getTime(),
        mtime: entry.header.time.getTime(),
        size: entry.header.size,
      };
    }

    // If not found, check if it's a directory by looking for children
    // (AdmZip might not have explicit directory entries for intermediate folders)
    const entries = zip.getEntries();
    const dirPrefix = cleanEntryPath.endsWith("/")
      ? cleanEntryPath
      : cleanEntryPath + "/";
    const hasChildren = entries.some((e) => e.entryName.startsWith(dirPrefix));

    if (hasChildren) {
      return { type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 };
    }

    throw vscode.FileSystemError.FileNotFound();
  }

  readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
    const { zipPath, entryPath } = this.parseUri(uri);
    const zip = this.getZip(zipPath);

    const cleanEntryPath = entryPath.startsWith("/")
      ? entryPath.substring(1)
      : entryPath;
    // Ensure standard format for comparison
    const prefix =
      cleanEntryPath === ""
        ? ""
        : cleanEntryPath.endsWith("/")
          ? cleanEntryPath
          : cleanEntryPath + "/";

    const result: Map<string, vscode.FileType> = new Map();

    zip.getEntries().forEach((entry) => {
      if (!entry.entryName.startsWith(prefix)) return;

      // Get relative path part
      const relative = entry.entryName.substring(prefix.length);
      if (!relative) return; // Same dir

      const parts = relative.split("/");
      const name = parts[0];

      // Check if it is a file or subdir
      const isDir = parts.length > 1 || entry.isDirectory;

      if (!result.has(name)) {
        result.set(
          name,
          isDir ? vscode.FileType.Directory : vscode.FileType.File,
        );
      }
    });

    return Array.from(result.entries());
  }

  readFile(uri: vscode.Uri): Uint8Array {
    const { zipPath, entryPath } = this.parseUri(uri);
    const zip = this.getZip(zipPath);
    const cleanEntryPath = entryPath.startsWith("/")
      ? entryPath.substring(1)
      : entryPath;

    const entry = zip.getEntry(cleanEntryPath);
    if (!entry) throw vscode.FileSystemError.FileNotFound();

    return new Uint8Array(entry.getData());
  }

  // Read-only for now
  writeFile(
    _uri: vscode.Uri,
    _content: Uint8Array,
    _options: { create: boolean; overwrite: boolean },
  ): void {
    throw vscode.FileSystemError.NoPermissions("Read-only ZIP support");
  }

  delete(_uri: vscode.Uri, _options: { recursive: boolean }): void {
    throw vscode.FileSystemError.NoPermissions("Read-only ZIP support");
  }

  rename(
    _oldUri: vscode.Uri,
    _newUri: vscode.Uri,
    _options: { overwrite: boolean },
  ): void {
    throw vscode.FileSystemError.NoPermissions("Read-only ZIP support");
  }

  createDirectory(_uri: vscode.Uri): void {
    throw vscode.FileSystemError.NoPermissions("Read-only ZIP support");
  }

  private parseUri(uri: vscode.Uri): { zipPath: string; entryPath: string } {
    // scheme: kuka-zip
    // authority: ignored?
    // path: /c:/path/to/archive.zip/inner/path

    // Strategy: The URI path contains the full path to zip + inner path.
    // We need a separator.
    // Let's assume usage: kuka-zip:///c:/Users/.../archive.zip/ folder/file
    // Actually, VS Code URIs for custom schemes are tricky.
    // Let's define: authority = empty
    // path = /absolute/path/to/zip/::/inner/path (using :: as separator)

    const pathStr = uri.path;
    const separatorIndex = pathStr.indexOf("/::");

    if (separatorIndex === -1) {
      // Maybe root?
      // Or maybe we treat the *authority* as the zip path?
      // Windows paths in authority are messy.
      throw vscode.FileSystemError.FileNotFound();
    }

    const zipPath = pathStr.substring(0, separatorIndex);
    const entryPath = pathStr.substring(separatorIndex + 3); // /:: is 3 chars

    // Fix Windows path if it starts with /c: -> c:
    const fsPath =
      zipPath.startsWith("/") && zipPath[2] === ":"
        ? zipPath.substring(1)
        : zipPath;

    return { zipPath: fsPath, entryPath };
  }

  private getZip(zipPath: string): AdmZip {
    if (!this.zips.has(zipPath)) {
      // Check file exists
      try {
        const zip = new AdmZip(zipPath);
        this.zips.set(zipPath, zip);
      } catch {
        throw vscode.FileSystemError.FileNotFound(zipPath);
      }
    }
    return this.zips.get(zipPath)!;
  }
}
