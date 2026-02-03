import * as vscode from "vscode";

export async function generateReport() {
  const files = await vscode.workspace.findFiles("**/*.{src,dat,sub}");
  const diagnostics = vscode.languages.getDiagnostics();

  let totalErrors = 0;
  let totalWarnings = 0;
  let totalHints = 0;
  let totalInfos = 0;

  // Aggregate diagnostics by URI string to avoid duplication if any
  const fileDiagnostics = new Map<string, vscode.Diagnostic[]>();

  diagnostics.forEach(([uri, diags]) => {
    // Only include KRL files or files with KRL diagnostics
    const uriStr = uri.toString();
    const isKrlFile = /\.(src|dat|sub)$/i.test(uri.fsPath);
    
    // We filter for KRL files OR if the source is our extension
    const krlDiags = diags.filter(d => d.source === "krl-language-support" || isKrlFile);

    if (krlDiags.length > 0) {
      fileDiagnostics.set(uriStr, krlDiags);
      krlDiags.forEach((d) => {
        switch (d.severity) {
          case vscode.DiagnosticSeverity.Error:
            totalErrors++;
            break;
          case vscode.DiagnosticSeverity.Warning:
            totalWarnings++;
            break;
          case vscode.DiagnosticSeverity.Information:
            totalInfos++;
            break;
          case vscode.DiagnosticSeverity.Hint:
            totalHints++;
            break;
        }
      });
    }
  });

  let report = `# KRL Project Analysis Report\n\n`;
  report += `**Date:** ${new Date().toLocaleString()}\n`;
  report += `**Total KRL Files:** ${files.length}\n`;
  report += `**Total Issues:** ${totalErrors + totalWarnings + totalInfos + totalHints}\n\n`;

  report += `## Summary\n`;
  report += `- 🔴 **Errors:** ${totalErrors}\n`;
  report += `- 🟡 **Warnings:** ${totalWarnings}\n`;
  report += `- 🔵 **Information:** ${totalInfos}\n`;
  report += `- ⚪ **Hints:** ${totalHints}\n\n`;

  report += `## Detailed Issues\n`;

  if (fileDiagnostics.size === 0) {
    report += "_No issues found in the workspace._\n";
  } else {
    // Sort files by path
    const sortedUris = Array.from(fileDiagnostics.keys()).sort();

    for (const uriStr of sortedUris) {
      const uri = vscode.Uri.parse(uriStr);
      const diags = fileDiagnostics.get(uriStr)!;
      const relativePath = vscode.workspace.asRelativePath(uri);

      report += `### 📄 ${relativePath}\n`;
      
      // Sort diagnostics by line number
      diags.sort((a, b) => a.range.start.line - b.range.start.line);

      diags.forEach((d) => {
        const line = d.range.start.line + 1;
        let icon = "";
        switch (d.severity) {
          case vscode.DiagnosticSeverity.Error:
            icon = "🔴";
            break;
          case vscode.DiagnosticSeverity.Warning:
            icon = "🟡";
            break;
          case vscode.DiagnosticSeverity.Information:
            icon = "🔵";
            break;
          case vscode.DiagnosticSeverity.Hint:
            icon = "⚪";
            break;
        }
        report += `- ${icon} **Line ${line}:** ${d.message}\n`;
      });
      report += "\n";
    }
  }

  // Open in new document
  const doc = await vscode.workspace.openTextDocument({
    content: report,
    language: "markdown",
  });
  await vscode.window.showTextDocument(doc);
}
