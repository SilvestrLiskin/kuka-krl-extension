import * as vscode from "vscode";

// Локализация
const translations = {
  en: {
    title: "KRL Frame Calculator",
    description:
      "Calculate transformations between coordinate systems (FRAME/POS).",
    howToUse: "How to use",
    usage: [
      "Enter coordinates X, Y, Z (mm) and angles A, B, C (degrees).",
      "F1 × F2 — multiply two frames (e.g., BASE × Offset = World position).",
      "INV(F1) — invert frame (useful for coordinate conversions).",
      "Click 'Load from Code' to fill from selected text in editor.",
    ],
    frame1: "Frame 1",
    frame2: "Frame 2",
    result: "Result",
    multiply: "F1 × F2",
    invert: "INV(F1)",
    copy: "Copy to Clipboard",
    loadFromCode: "Load from Code",
    copied: "Copied!",
    noSelection: "No valid FRAME/POS found in selection",
    // Converter
    converterTitle: "🔄 Coordinate System Converter",
    converterDesc: "Convert a point from one coordinate system to another",
    sourceBase: "Source BASE",
    targetBase: "Target BASE",
    world: "WORLD (no transformation)",
    pointToConvert: "Point to Convert",
    convert: "Convert",
    convertResult: "Result in Target System",
  },
  ru: {
    title: "KRL Калькулятор Координат",
    description: "Расчёт трансформаций между системами координат (FRAME/POS).",
    howToUse: "Как использовать",
    usage: [
      "Введите координаты X, Y, Z (мм) и углы A, B, C (градусы).",
      "F1 × F2 — умножение двух фреймов (например, BASE × Offset = позиция в World).",
      "INV(F1) — инверсия фрейма (для преобразования координат).",
      "Нажмите 'Загрузить из кода' чтобы заполнить из выделенного текста.",
    ],
    frame1: "Фрейм 1",
    frame2: "Фрейм 2",
    result: "Результат",
    multiply: "F1 × F2",
    invert: "INV(F1)",
    copy: "Копировать",
    loadFromCode: "Загрузить из кода",
    copied: "Скопировано!",
    noSelection: "Не найден FRAME/POS в выделении",
    // Converter
    converterTitle: "🔄 Конвертер Систем Координат",
    converterDesc: "Преобразовать точку из одной системы координат в другую",
    sourceBase: "Исходная BASE",
    targetBase: "Целевая BASE",
    world: "WORLD (без трансформации)",
    pointToConvert: "Точка для преобразования",
    convert: "Преобразовать",
    convertResult: "Результат в целевой системе",
  },
  tr: {
    title: "KRL Çerçeve Hesaplayıcı",
    description: "Koordinat sistemleri arasında dönüşüm hesaplama (FRAME/POS).",
    howToUse: "Nasıl Kullanılır",
    usage: [
      "X, Y, Z koordinatlarını (mm) ve A, B, C açılarını (derece) girin.",
      "F1 × F2 — iki çerçeveyi çarpın (örn: BASE × Ofset = World konumu).",
      "INV(F1) — çerçeveyi tersine çevirin (koordinat dönüşümü için).",
      "'Koddan Yükle' ile editördeki seçili metinden doldurun.",
    ],
    frame1: "Çerçeve 1",
    frame2: "Çerçeve 2",
    result: "Sonuç",
    multiply: "F1 × F2",
    invert: "INV(F1)",
    copy: "Panoya Kopyala",
    loadFromCode: "Koddan Yükle",
    copied: "Kopyalandı!",
    noSelection: "Seçimde geçerli FRAME/POS bulunamadı",
    // Converter
    converterTitle: "🔄 Koordinat Sistemi Dönüştürücü",
    converterDesc: "Bir noktayı bir koordinat sisteminden diğerine dönüştürün",
    sourceBase: "Kaynak BASE",
    targetBase: "Hedef BASE",
    world: "WORLD (dönüşüm yok)",
    pointToConvert: "Dönüştürülecek Nokta",
    convert: "Dönüştür",
    convertResult: "Hedef Sistemde Sonuç",
  },
};

function getLocale(): "en" | "ru" | "tr" {
  const lang = vscode.env.language;
  if (lang.startsWith("ru")) return "ru";
  if (lang.startsWith("tr")) return "tr";
  return "en";
}

export function showCalculator(context: vscode.ExtensionContext) {
  const panel = vscode.window.createWebviewPanel(
    "krlCalculator",
    "KRL Frame Calculator",
    vscode.ViewColumn.Two,
    { enableScripts: true },
  );

  const locale = getLocale();
  const t = translations[locale];

  // Handle messages from webview
  panel.webview.onDidReceiveMessage(
    async (message) => {
      if (message.command === "loadFromCode") {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          const selection = editor.document.getText(editor.selection);
          const frame = parseFrameFromText(
            selection || editor.document.getText(),
          );
          if (frame) {
            panel.webview.postMessage({
              command: "setFrame",
              target: message.target,
              frame,
            });
          } else {
            vscode.window.showWarningMessage(t.noSelection);
          }
        }
      } else if (message.command === "pickVariable") {
        const items = await collectFrameVariables();
        if (items.length === 0) {
          vscode.window.showInformationMessage(
            "No BASE/TOOL/POS variables found",
          );
          return;
        }
        const picked = await vscode.window.showQuickPick(items, {
          placeHolder: "Select a variable to load",
        });
        if (picked) {
          panel.webview.postMessage({
            command: "setFrame",
            target: message.target,
            frame: picked.frame,
          });
        }
      }
    },
    undefined,
    context.subscriptions,
  );

  panel.webview.html = getWebviewContent(t);
}

// Parse FRAME/POS from text like {X 100, Y 200, Z 300, A 0, B 0, C 0}
function parseFrameFromText(
  text: string,
): { x: number; y: number; z: number; a: number; b: number; c: number } | null {
  // Match patterns like: {X 100.5, Y -50, Z 300, A 90, B 0, C 0}
  const regex =
    /\{[^}]*X\s*([-\d.]+)[^}]*Y\s*([-\d.]+)[^}]*Z\s*([-\d.]+)[^}]*A\s*([-\d.]+)[^}]*B\s*([-\d.]+)[^}]*C\s*([-\d.]+)/i;
  const match = text.match(regex);
  if (match) {
    return {
      x: parseFloat(match[1]) || 0,
      y: parseFloat(match[2]) || 0,
      z: parseFloat(match[3]) || 0,
      a: parseFloat(match[4]) || 0,
      b: parseFloat(match[5]) || 0,
      c: parseFloat(match[6]) || 0,
    };
  }
  return null;
}

// Collect BASE, TOOL, POS variables from ALL workspace files, grouped by category
async function collectFrameVariables(): Promise<
  Array<
    vscode.QuickPickItem & {
      frame?: {
        x: number;
        y: number;
        z: number;
        a: number;
        b: number;
        c: number;
      };
    }
  >
> {
  const categories: Record<
    string,
    Array<{
      label: string;
      description: string;
      detail: string;
      frame: {
        x: number;
        y: number;
        z: number;
        a: number;
        b: number;
        c: number;
      };
    }>
  > = {
    "📍 BASE (Coordinate Systems)": [],
    "🔧 TOOL (Tool Data)": [],
    "📌 POS / E6POS (Positions)": [],
    "🔲 FRAME (Generic Frames)": [],
  };

  // Scan all .dat files in workspace
  const files = await vscode.workspace.findFiles(
    "**/*.dat",
    "**/node_modules/**",
    100,
  );

  for (const fileUri of files) {
    try {
      const doc = await vscode.workspace.openTextDocument(fileUri);
      const text = doc.getText();
      const fileName = fileUri.fsPath.split(/[/\\]/).pop() || "";

      // Regex for various KUKA frame types
      const patterns = [
        {
          regex: /(\$?BASE(?:_DATA)?\s*(?:\[\d+\])?)\s*=\s*(\{[^}]+\})/gi,
          category: "📍 BASE (Coordinate Systems)",
        },
        {
          regex: /(\$?TOOL(?:_DATA)?\s*(?:\[\d+\])?)\s*=\s*(\{[^}]+\})/gi,
          category: "🔧 TOOL (Tool Data)",
        },
        {
          regex: /((?:E6)?POS\s+\w+)\s*=\s*(\{[^}]+\})/gi,
          category: "📌 POS / E6POS (Positions)",
        },
        {
          regex: /(FRAME\s+\w+)\s*=\s*(\{[^}]+\})/gi,
          category: "🔲 FRAME (Generic Frames)",
        },
        {
          regex: /(XP\d+)\s*=\s*(\{[^}]+\})/gi,
          category: "📌 POS / E6POS (Positions)",
        },
      ];

      for (const { regex, category } of patterns) {
        let match;
        while ((match = regex.exec(text)) !== null) {
          const varName = match[1].trim();
          const frameStr = match[2];
          const frame = parseFrameFromText(frameStr);
          if (frame) {
            categories[category].push({
              label: varName,
              description: `X:${frame.x.toFixed(1)} Y:${frame.y.toFixed(1)} Z:${frame.z.toFixed(1)}`,
              detail: fileName,
              frame,
            });
          }
        }
      }
    } catch {
      // Skip files that can't be opened
    }
  }

  // Build QuickPick items with separators
  const items: Array<
    vscode.QuickPickItem & {
      frame?: {
        x: number;
        y: number;
        z: number;
        a: number;
        b: number;
        c: number;
      };
    }
  > = [];

  for (const [category, vars] of Object.entries(categories)) {
    if (vars.length === 0) continue;

    // Add category header (separator)
    items.push({ label: category, kind: vscode.QuickPickItemKind.Separator });

    // Add variables
    for (const v of vars) {
      items.push({
        label: v.label,
        description: v.description,
        detail: v.detail,
        frame: v.frame,
      });
    }
  }

  return items;
}

function getWebviewContent(t: typeof translations.en) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${t.title}</title>
    <style>
        * { box-sizing: border-box; }
        body { 
            font-family: var(--vscode-font-family, sans-serif); 
            padding: 16px; 
            color: var(--vscode-editor-foreground); 
            background-color: var(--vscode-editor-background);
            max-width: 500px;
        }
        h2 { margin: 0 0 8px; font-size: 1.3em; }
        .description { 
            color: var(--vscode-descriptionForeground); 
            margin-bottom: 12px; 
            font-size: 0.9em;
        }
        .help-section {
            background: var(--vscode-textBlockQuote-background);
            border-left: 3px solid var(--vscode-textLink-foreground);
            padding: 8px 12px;
            margin-bottom: 16px;
            font-size: 0.85em;
        }
        .help-section h4 { margin: 0 0 6px; }
        .help-section ul { margin: 0; padding-left: 18px; }
        .help-section li { margin: 2px 0; }
        .frame-input { 
            margin-bottom: 12px; 
            padding: 10px; 
            border: 1px solid var(--vscode-widget-border);
            border-radius: 4px;
        }
        .frame-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        .frame-header h3 { margin: 0; font-size: 1em; }
        .row { display: flex; gap: 8px; margin-bottom: 4px; }
        .field { display: flex; align-items: center; gap: 4px; }
        .field label { width: 16px; font-weight: bold; }
        .field input { 
            width: 70px; 
            padding: 4px 6px;
            background: var(--vscode-input-background); 
            color: var(--vscode-input-foreground); 
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
        }
        .actions { 
            display: flex; 
            gap: 8px; 
            margin: 12px 0;
            flex-wrap: wrap;
        }
        button { 
            padding: 6px 14px; 
            background: var(--vscode-button-background); 
            color: var(--vscode-button-foreground); 
            border: none; 
            cursor: pointer;
            border-radius: 2px;
            font-size: 0.9em;
        }
        button:hover { background: var(--vscode-button-hoverBackground); }
        button.secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
        .result-frame { background: var(--vscode-textBlockQuote-background); }
        .result-frame input { font-weight: bold; }
        .toast {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: var(--vscode-notificationsInfoIcon-foreground);
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            display: none;
        }
        .toast.show { display: block; }
    </style>
</head>
<body>
    <h2>${t.title}</h2>
    <p class="description">${t.description}</p>
    
    <div class="help-section">
        <h4>${t.howToUse}</h4>
        <ul>
            ${t.usage.map((u) => `<li>${u}</li>`).join("")}
        </ul>
    </div>
    
    <div class="frame-input" id="f1">
        <div class="frame-header">
            <h3>${t.frame1}</h3>
            <button class="secondary" onclick="pickVariable('f1')">${t.loadFromCode}</button>
        </div>
        <div class="row">
            <div class="field"><label>X</label><input type="number" step="0.001" value="0"></div>
            <div class="field"><label>Y</label><input type="number" step="0.001" value="0"></div>
            <div class="field"><label>Z</label><input type="number" step="0.001" value="0"></div>
        </div>
        <div class="row">
            <div class="field"><label>A</label><input type="number" step="0.001" value="0"></div>
            <div class="field"><label>B</label><input type="number" step="0.001" value="0"></div>
            <div class="field"><label>C</label><input type="number" step="0.001" value="0"></div>
        </div>
    </div>

    <div class="actions">
        <button onclick="multiply()">${t.multiply}</button>
        <button onclick="invert()">${t.invert}</button>
    </div>

    <div class="frame-input" id="f2">
        <div class="frame-header">
            <h3>${t.frame2}</h3>
            <button class="secondary" onclick="pickVariable('f2')">${t.loadFromCode}</button>
        </div>
        <div class="row">
            <div class="field"><label>X</label><input type="number" step="0.001" value="0"></div>
            <div class="field"><label>Y</label><input type="number" step="0.001" value="0"></div>
            <div class="field"><label>Z</label><input type="number" step="0.001" value="0"></div>
        </div>
        <div class="row">
            <div class="field"><label>A</label><input type="number" step="0.001" value="0"></div>
            <div class="field"><label>B</label><input type="number" step="0.001" value="0"></div>
            <div class="field"><label>C</label><input type="number" step="0.001" value="0"></div>
        </div>
    </div>

    <div class="frame-input result-frame" id="result">
        <div class="frame-header">
            <h3>${t.result}</h3>
            <button onclick="copyResult('result')">${t.copy}</button>
        </div>
        <div class="row">
            <div class="field"><label>X</label><input type="number" readonly id="resX"></div>
            <div class="field"><label>Y</label><input type="number" readonly id="resY"></div>
            <div class="field"><label>Z</label><input type="number" readonly id="resZ"></div>
        </div>
        <div class="row">
            <div class="field"><label>A</label><input type="number" readonly id="resA"></div>
            <div class="field"><label>B</label><input type="number" readonly id="resB"></div>
            <div class="field"><label>C</label><input type="number" readonly id="resC"></div>
        </div>
    </div>

    <!-- Converter Section -->
    <hr style="margin: 24px 0; border-color: var(--vscode-widget-border);">
    
    <h3>${t.converterTitle}</h3>
    <p class="description">${t.converterDesc}</p>

    <div class="frame-input" id="srcBase">
        <div class="frame-header">
            <h3>${t.sourceBase}</h3>
            <button class="secondary" onclick="pickVariable('srcBase')">${t.loadFromCode}</button>
        </div>
        <div class="row">
            <div class="field"><label>X</label><input type="number" step="0.001" value="0"></div>
            <div class="field"><label>Y</label><input type="number" step="0.001" value="0"></div>
            <div class="field"><label>Z</label><input type="number" step="0.001" value="0"></div>
        </div>
        <div class="row">
            <div class="field"><label>A</label><input type="number" step="0.001" value="0"></div>
            <div class="field"><label>B</label><input type="number" step="0.001" value="0"></div>
            <div class="field"><label>C</label><input type="number" step="0.001" value="0"></div>
        </div>
    </div>

    <div class="frame-input" id="tgtBase">
        <div class="frame-header">
            <h3>${t.targetBase}</h3>
            <button class="secondary" onclick="pickVariable('tgtBase')">${t.loadFromCode}</button>
        </div>
        <div style="margin-bottom: 8px;">
            <label><input type="checkbox" id="tgtIsWorld" onchange="toggleWorldTarget()"> ${t.world}</label>
        </div>
        <div id="tgtBaseFields">
            <div class="row">
                <div class="field"><label>X</label><input type="number" step="0.001" value="0"></div>
                <div class="field"><label>Y</label><input type="number" step="0.001" value="0"></div>
                <div class="field"><label>Z</label><input type="number" step="0.001" value="0"></div>
            </div>
            <div class="row">
                <div class="field"><label>A</label><input type="number" step="0.001" value="0"></div>
                <div class="field"><label>B</label><input type="number" step="0.001" value="0"></div>
                <div class="field"><label>C</label><input type="number" step="0.001" value="0"></div>
            </div>
        </div>
    </div>

    <div class="frame-input" id="pointConv">
        <div class="frame-header">
            <h3>${t.pointToConvert}</h3>
            <button class="secondary" onclick="pickVariable('pointConv')">${t.loadFromCode}</button>
        </div>
        <div class="row">
            <div class="field"><label>X</label><input type="number" step="0.001" value="0"></div>
            <div class="field"><label>Y</label><input type="number" step="0.001" value="0"></div>
            <div class="field"><label>Z</label><input type="number" step="0.001" value="0"></div>
        </div>
        <div class="row">
            <div class="field"><label>A</label><input type="number" step="0.001" value="0"></div>
            <div class="field"><label>B</label><input type="number" step="0.001" value="0"></div>
            <div class="field"><label>C</label><input type="number" step="0.001" value="0"></div>
        </div>
    </div>

    <div class="actions">
        <button onclick="convertCoords()">${t.convert}</button>
    </div>

    <div class="frame-input result-frame" id="convResult">
        <div class="frame-header">
            <h3>${t.convertResult}</h3>
            <button onclick="copyResult('convResult')">${t.copy}</button>
        </div>
        <div class="row">
            <div class="field"><label>X</label><input type="number" readonly></div>
            <div class="field"><label>Y</label><input type="number" readonly></div>
            <div class="field"><label>Z</label><input type="number" readonly></div>
        </div>
        <div class="row">
            <div class="field"><label>A</label><input type="number" readonly></div>
            <div class="field"><label>B</label><input type="number" readonly></div>
            <div class="field"><label>C</label><input type="number" readonly></div>
        </div>
    </div>

    <div class="toast" id="toast">${t.copied}</div>

    <script>
        const vscode = acquireVsCodeApi();

        function getFrame(id) {
            const inputs = document.querySelectorAll('#' + id + ' input[type="number"]');
            return {
                x: parseFloat(inputs[0].value) || 0,
                y: parseFloat(inputs[1].value) || 0,
                z: parseFloat(inputs[2].value) || 0,
                a: parseFloat(inputs[3].value) || 0,
                b: parseFloat(inputs[4].value) || 0,
                c: parseFloat(inputs[5].value) || 0
            };
        }

        function setFrame(id, f) {
            const inputs = document.querySelectorAll('#' + id + ' input[type="number"]');
            inputs[0].value = f.x.toFixed(3);
            inputs[1].value = f.y.toFixed(3);
            inputs[2].value = f.z.toFixed(3);
            inputs[3].value = f.a.toFixed(3);
            inputs[4].value = f.b.toFixed(3);
            inputs[5].value = f.c.toFixed(3);
        }

        function toRad(deg) { return deg * Math.PI / 180; }
        function toDeg(rad) { return rad * 180 / Math.PI; }

        function getMatrix(f) {
            const A = toRad(f.a), B = toRad(f.b), C = toRad(f.c);
            const ca = Math.cos(A), sa = Math.sin(A);
            const cb = Math.cos(B), sb = Math.sin(B);
            const cc = Math.cos(C), sc = Math.sin(C);
            return [
                ca*cb, ca*sb*sc - sa*cc, ca*sb*cc + sa*sc, f.x,
                sa*cb, sa*sb*sc + ca*cc, sa*sb*cc - ca*sc, f.y,
                -sb,   cb*sc,            cb*cc,            f.z,
                0, 0, 0, 1
            ];
        }

        function matMult(A, B) {
            const C = new Array(16).fill(0);
            for(let i=0; i<4; i++) {
                for(let j=0; j<4; j++) {
                    for(let k=0; k<4; k++) {
                        C[i*4+j] += A[i*4+k] * B[k*4+j];
                    }
                }
            }
            return C;
        }

        function invertMatrix(m) {
            const r11=m[0], r12=m[1], r13=m[2];
            const r21=m[4], r22=m[5], r23=m[6];
            const r31=m[8], r32=m[9], r33=m[10];
            const px=m[3], py=m[7], pz=m[11];
            
            const i11=r11, i12=r21, i13=r31;
            const i21=r12, i22=r22, i23=r32;
            const i31=r13, i32=r23, i33=r33;
            
            const ix = -(i11*px + i12*py + i13*pz);
            const iy = -(i21*px + i22*py + i23*pz);
            const iz = -(i31*px + i32*py + i33*pz);
            
            return [i11,i12,i13,ix, i21,i22,i23,iy, i31,i32,i33,iz, 0,0,0,1];
        }

        function fromMatrix(M) {
            const r11 = M[0], r21 = M[4], r31 = M[8];
            const r32 = M[9], r33 = M[10], r22 = M[5], r23 = M[6];
            const x = M[3], y = M[7], z = M[11];
            
            const sy = Math.sqrt(r11*r11 + r21*r21);
            let a, b, c;
            if (sy > 1e-6) {
                b = Math.atan2(-r31, sy);
                a = Math.atan2(r21, r11);
                c = Math.atan2(r32, r33);
            } else {
                b = Math.atan2(-r31, sy);
                a = Math.atan2(-r23, r22);
                c = 0;
            }
            return { x, y, z, a: toDeg(a), b: toDeg(b), c: toDeg(c) };
        }

        function multiply() {
            const f1 = getFrame('f1'), f2 = getFrame('f2');
            const mRes = matMult(getMatrix(f1), getMatrix(f2));
            setFrame('result', fromMatrix(mRes));
        }

        function invert() {
            const m = getMatrix(getFrame('f1'));
            const mInv = invertMatrix(m);
            setFrame('result', fromMatrix(mInv));
        }

        // Converter: Point_in_Target = INV(Target) × Source × Point
        function convertCoords() {
            const srcBase = getFrame('srcBase');
            const point = getFrame('pointConv');
            const isWorld = document.getElementById('tgtIsWorld').checked;

            // Step 1: Point in WORLD = Source × Point
            const mSrc = getMatrix(srcBase);
            const mPoint = getMatrix(point);
            const mWorld = matMult(mSrc, mPoint);

            if (isWorld) {
                // Target is WORLD, no further transformation
                setFrame('convResult', fromMatrix(mWorld));
            } else {
                // Step 2: Point in Target = INV(Target) × WorldPoint
                const tgtBase = getFrame('tgtBase');
                const mTgt = getMatrix(tgtBase);
                const mTgtInv = invertMatrix(mTgt);
                const mResult = matMult(mTgtInv, mWorld);
                setFrame('convResult', fromMatrix(mResult));
            }
        }

        function toggleWorldTarget() {
            const fields = document.getElementById('tgtBaseFields');
            const isWorld = document.getElementById('tgtIsWorld').checked;
            fields.style.display = isWorld ? 'none' : 'block';
        }
        
        function copyResult(frameId) {
            const f = getFrame(frameId);
            const str = \`{X \${f.x.toFixed(3)}, Y \${f.y.toFixed(3)}, Z \${f.z.toFixed(3)}, A \${f.a.toFixed(3)}, B \${f.b.toFixed(3)}, C \${f.c.toFixed(3)}}\`;
            const el = document.createElement('textarea');
            el.value = str;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            
            const toast = document.getElementById('toast');
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 1500);
        }

        function pickVariable(target) {
            vscode.postMessage({ command: 'pickVariable', target });
        }

        // Listen for messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'setFrame') {
                setFrame(message.target, message.frame);
            }
        });
    </script>
</body>
</html>`;
}
