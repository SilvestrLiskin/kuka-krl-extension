## 2025-02-18 - [Tree View Empty States]
**Learning:** VS Code's `viewsWelcome` contribution only triggers when `TreeDataProvider.getChildren()` returns `[]` or `undefined` for the root element. If the provider returns empty container items (like "Inputs", "Outputs" categories), the welcome message will never show, leaving the user with a confusing empty list.
**Action:** Always verify `getChildren` logic returns `[]` when the logical content is empty, rather than returning empty structural nodes.
