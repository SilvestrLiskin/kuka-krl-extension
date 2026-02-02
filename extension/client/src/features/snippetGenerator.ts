import * as vscode from 'vscode';
import * as path from 'path';

export function showSnippetGenerator(context: vscode.ExtensionContext) {
    const panel = vscode.window.createWebviewPanel(
        'krlSnippetGenerator',
        'KRL Snippet Generator',
        vscode.ViewColumn.Beside,
        {
            enableScripts: true,
            localResourceRoots: []
        }
    );

    panel.webview.html = getWebviewContent();

    panel.webview.onDidReceiveMessage(
        message => {
            switch (message.command) {
                case 'insertCode':
                    const editor = vscode.window.activeTextEditor;
                    if (editor) {
                        editor.edit(editBuilder => {
                            editBuilder.insert(editor.selection.active, message.text);
                        });
                        vscode.window.showInformationMessage('Snippet inserted!');
                    } else {
                        vscode.window.showErrorMessage('No active KRL editor found!');
                    }
                    return;
            }
        },
        undefined,
        context.subscriptions
    );
}

function getWebviewContent() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>KRL Snippet Generator</title>
    <style>
        body { font-family: var(--vscode-font-family); color: var(--vscode-editor-foreground); background-color: var(--vscode-editor-background); padding: 20px; }
        h2 { border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 10px; }
        .tab { overflow: hidden; border: 1px solid #333; background-color: var(--vscode-editor-background); display: flex; }
        .tab button { background-color: inherit; border: none; outline: none; cursor: pointer; padding: 10px 16px; transition: 0.3s; color: var(--vscode-editor-foreground); opacity: 0.7; border-bottom: 2px solid transparent; }
        .tab button:hover { opacity: 1; background-color: var(--vscode-list-hoverBackground); }
        .tab button.active { opacity: 1; border-bottom: 2px solid var(--vscode-panelTitle-activeBorder); font-weight: bold; }
        .tabcontent { display: none; padding: 20px; border: 1px solid var(--vscode-panel-border); border-top: none; animation: fadeEffect 0.5s; }
        @keyframes fadeEffect { from {opacity: 0;} to {opacity: 1;} }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input, select, textarea { width: 100%; padding: 8px; box-sizing: border-box; background-color: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); }
        button.action-btn { background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); padding: 10px 20px; border: none; cursor: pointer; margin-top: 10px; font-size: 14px; }
        button.action-btn:hover { background-color: var(--vscode-button-hoverBackground); }
        .code-preview { background-color: var(--vscode-textBlockQuote-background); padding: 10px; border-left: 4px solid var(--vscode-textBlockQuote-border); font-family: monospace; white-space: pre-wrap; margin-top: 20px; }
    </style>
</head>
<body>
    <h2>KRL Snippet Generator</h2>

    <div class="tab">
        <button class="tablinks active" onclick="openTab(event, 'Message')">Message Builder</button>
        <button class="tablinks" onclick="openTab(event, 'Grid')">Grid Pattern</button>
    </div>

    <div id="Message" class="tabcontent" style="display: block;">
        <h3>KUKA User Message</h3>
        <p>Generates code for KUKA User Messages (KrlMsg).</p>
        <div class="form-group">
            <label>Type</label>
            <select id="msgType">
                <option value="Notify">Notify (Log)</option>
                <option value="Quit">Quit (Acknowledge)</option>
                <option value="State">State (Status)</option>
                <option value="Wait">Wait (Blocking)</option>
            </select>
        </div>
        <div class="form-group">
            <label>Key (Unique ID)</label>
            <input type="text" id="msgKey" placeholder="e.g. MyMsg1" value="Msg1">
        </div>
        <div class="form-group">
            <label>Message Text (use %1, %2 for params)</label>
            <input type="text" id="msgText" placeholder="e.g. Value is %1" value="Process started">
        </div>
        <div class="form-group">
            <label>Parameter 1 (Optional)</label>
            <input type="text" id="msgP1" placeholder="e.g. nCount">
        </div>
        <button class="action-btn" onclick="generateMessage()">Insert Snippet</button>
    </div>

    <div id="Grid" class="tabcontent">
        <h3>Palletizing Grid</h3>
        <p>Generates nested loops for a grid pattern.</p>
        <div class="form-group">
            <label>Base Point Name</label>
            <input type="text" id="gridBase" value="xBasePoint">
        </div>
        <div class="form-group">
            <label>Rows (X)</label>
            <input type="number" id="gridRows" value="3">
        </div>
        <div class="form-group">
            <label>Cols (Y)</label>
            <input type="number" id="gridCols" value="2">
        </div>
        <div class="form-group">
            <label>Spacing X (mm)</label>
            <input type="number" id="gridSpaceX" value="100">
        </div>
        <div class="form-group">
            <label>Spacing Y (mm)</label>
            <input type="number" id="gridSpaceY" value="100">
        </div>
        <button class="action-btn" onclick="generateGrid()">Insert Snippet</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function openTab(evt, tabName) {
            var i, tabcontent, tablinks;
            tabcontent = document.getElementsByClassName("tabcontent");
            for (i = 0; i < tabcontent.length; i++) {
                tabcontent[i].style.display = "none";
            }
            tablinks = document.getElementsByClassName("tablinks");
            for (i = 0; i < tablinks.length; i++) {
                tablinks[i].className = tablinks[i].className.replace(" active", "");
            }
            document.getElementById(tabName).style.display = "block";
            evt.currentTarget.className += " active";
        }

        function generateMessage() {
            const type = document.getElementById('msgType').value;
            const key = document.getElementById('msgKey').value || "Msg1";
            const text = document.getElementById('msgText').value || "Message";
            const p1 = document.getElementById('msgP1').value;

            // Generate clean code
            let krl = \`;FOLD Message: \${text}\n\`;
            krl += \`decl KrlMsg_T msg\n\`;
            krl += \`decl KrlMsgPar_T par[3]\n\`;
            krl += \`decl KrlMsgOpt_T opt\n\`;
            krl += \`decl INT handle\n\n\`;

            krl += \`msg = {Modul[] "User", Nr 1, Msg_txt[] "\${text}"}\n\`;
            
            if (p1) {
                krl += \`par[1] = {Par_type #Value, Par_int \${p1}}\n\`;
            }

            if (type === 'Notify') {
                krl += \`handle = Set_KrlMsg(#Notify, msg, par[], opt)\n\`;
            } else if (type === 'Quit') {
                 krl += \`handle = Set_KrlMsg(#Quit, msg, par[], opt)\n\`;
                 krl += \`WHILE ( Exists_KrlMsg(handle) )\n  WAIT SEC 0.1\nENDWHILE\n\`;
            } else if (type === 'State') {
                krl += \`handle = Set_KrlMsg(#State, msg, par[], opt)\n\`;
            } else if (type === 'Wait') {
                krl += \`handle = Set_KrlMsg(#Waiting, msg, par[], opt)\n\`;
            }
            krl += \`;ENDFOLD\n\`;
            
            vscode.postMessage({
                command: 'insertCode',
                text: krl
            });
        }

        function generateGrid() {
            const base = document.getElementById('gridBase').value;
            const rows = document.getElementById('gridRows').value;
            const cols = document.getElementById('gridCols').value;
            const spaceX = document.getElementById('gridSpaceX').value;
            const spaceY = document.getElementById('gridSpaceY').value;

            let krl = \`;FOLD Grid Pattern\n\`;
            krl += \`; Please declare these at the top of your file:\n\`;
            krl += \`; DECL INT i_grid, j_grid\n\`;
            krl += \`; DECL FRAME fPos\n\n\`;

            krl += \`FOR i_grid = 1 TO \${rows}\n\`;
            krl += \`  FOR j_grid = 1 TO \${cols}\n\`;
            krl += \`    fPos = \${base}\n\`;
            krl += \`    fPos.X = fPos.X + (i_grid-1) * \${spaceX}\n\`;
            krl += \`    fPos.Y = fPos.Y + (j_grid-1) * \${spaceY}\n\`;
            krl += \`    \n\`;
            krl += \`    ; Move to position\n\`;
            krl += \`    LIN fPos\n\`;
            krl += \`    \n\`;
            krl += \`  ENDFOR\n\`;
            krl += \`ENDFOR\n\`;
            krl += \`;ENDFOLD\n\`;

            vscode.postMessage({
                command: 'insertCode',
                text: krl
            });
        }
    </script>
</body>
</html>`;
}
