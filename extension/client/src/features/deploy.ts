import * as vscode from "vscode";
import * as path from "path";
import * as ftp from "basic-ftp";

/**
 * Развертывание (деплой) текущего файла на робот через FTP.
 */
export async function deployToRobot() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("Нет активного файла для деплоя.");
    return;
  }

  const doc = editor.document;
  const localPath = doc.fileName;
  const fileName = path.basename(localPath);
  const ext = path.extname(localPath).toLowerCase();

  // Проверка, является ли файл KRL
  if (![".src", ".dat", ".sub"].includes(ext)) {
    const proceed = await vscode.window.showWarningMessage(
      `Файл ${fileName} не похож на KRL файл. Все равно деплоить?`,
      "Да",
      "Нет",
    );
    if (proceed !== "Да") return;
  }

  // Загрузка конфигурации
  const config = vscode.workspace.getConfiguration("krl.deploy");
  const host = config.get<string>("ip", "172.31.1.147");
  const user = config.get<string>("user", "kukauser");
  const password = config.get<string>("password", "kukauser");
  const targetPath = config.get<string>("targetPath", "/R1/Program");

  const client = new ftp.Client();

  // файлы для загрузки
  const uploads = [localPath];

  // Если это src/dat, пытаемся найти пару
  if (ext === ".src") {
    const datPath = localPath.replace(/\.src$/i, ".dat");
    try {
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
      title: `Деплой на ${host}...`,
      cancellable: true,
    },
    async (progress, token) => {
      try {
        progress.report({ message: "Подключение..." });

        await client.access({
          host,
          user,
          password,
          secure: false, // KUKA обычно использует простой FTP
        });

        progress.report({ message: "Загрузка файлов..." });

        await client.ensureDir(targetPath);

        for (const file of uploads) {
          const name = path.basename(file);
          if (token.isCancellationRequested) break;

          progress.report({ message: `Загрузка ${name}...` });
          await client.uploadFrom(file, `${targetPath}/${name}`);
        }

        if (!token.isCancellationRequested) {
          vscode.window.showInformationMessage(
            `Успешно загружено ${uploads.length} файлов на ${host}.`,
          );
        }
      } catch (err: unknown) {
        vscode.window.showErrorMessage(
          `Ошибка деплоя: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        client.close();
      }
    },
  );
}
