import * as vscode from "vscode";
import * as path from "path";
import * as ftp from "basic-ftp";
// i18n import removed - not used in this file

export async function deployToRobot() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("No active file to deploy.");
    return;
  }

  const doc = editor.document;
  const localPath = doc.fileName;
  const fileName = path.basename(localPath);
  const ext = path.extname(localPath).toLowerCase();

  // Check if it's a KRL file
  if (![".src", ".dat", ".sub"].includes(ext)) {
    const proceed = await vscode.window.showWarningMessage(
      `File ${fileName} does not look like a KRL file. Deploy anyway?`,
      "Yes",
      "No",
    );
    if (proceed !== "Yes") return;
  }

  // Load config
  const config = vscode.workspace.getConfiguration("krl.deploy");
  const host = config.get<string>("ip", "172.31.1.147");
  const user = config.get<string>("user", "kukauser");
  const password = config.get<string>("password", "kukauser");
  const targetPath = config.get<string>("targetPath", "/R1/Program");

  const client = new ftp.Client();
  // client.ftp.verbose = true;

  // files to upload
  const uploads = [localPath];

  // If src/dat, try to find the pair
  if (ext === ".src") {
    const datPath = localPath.replace(/\.src$/i, ".dat");
    // We can't easily check if file exists without fs, but vscode fs is available
    // assuming standard fs for local files
    try {
      // Just add it, basic-ftp uploadFrom will throw if missing?
      // Better to check.
      const fs = require("fs");
      if (fs.existsSync(datPath)) {
        uploads.push(datPath);
      }
    } catch {}
  } else if (ext === ".dat") {
    const srcPath = localPath.replace(/\.dat$/i, ".src");
    try {
      const fs = require("fs");
      if (fs.existsSync(srcPath)) {
        uploads.push(srcPath);
      }
    } catch {}
  }

  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Deploying to ${host}...`,
      cancellable: true,
    },
    async (progress, token) => {
      try {
        progress.report({ message: "Connecting..." });

        await client.access({
          host,
          user,
          password,
          secure: false, // KUKA usually uses plain FTP
        });

        progress.report({ message: "Uploading files..." });

        await client.ensureDir(targetPath);

        for (const file of uploads) {
          const name = path.basename(file);
          if (token.isCancellationRequested) break;

          progress.report({ message: `Uploading ${name}...` });
          await client.uploadFrom(file, `${targetPath}/${name}`);
        }

        if (!token.isCancellationRequested) {
          vscode.window.showInformationMessage(
            `Successfully deployed ${uploads.length} files to ${host}.`,
          );
        }
      } catch (err: unknown) {
        vscode.window.showErrorMessage(
          `Deploy failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        client.close();
      }
    },
  );
}
