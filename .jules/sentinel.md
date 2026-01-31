## 2024-10-24 - Hardcoded FTP Password in Configuration
**Vulnerability:** Found a hardcoded default password ("kukauser") in `package.json` configuration and `deploy.ts`. This encourages users to rely on the insecure default and exposes the credential in the source code.
**Learning:** Defining default values for sensitive settings in VS Code extension manifests creates a persistent security risk and discourages secure configuration practices.
**Prevention:** Avoid `default` values for sensitive fields in `configuration` schemas. Instead, handle the `undefined` case in code by prompting the user securely (e.g., via `vscode.window.showInputBox` with `password: true`).
