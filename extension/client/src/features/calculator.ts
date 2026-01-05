import * as vscode from "vscode";

export function showCalculator(_context: vscode.ExtensionContext) {
  const panel = vscode.window.createWebviewPanel(
    "krlCalculator",
    "KRL Frame Calculator",
    vscode.ViewColumn.One,
    { enableScripts: true },
  );

  panel.webview.html = getWebviewContent();
}

function getWebviewContent() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>KRL Calculator</title>
    <style>
        body { font-family: sans-serif; padding: 20px; color: var(--vscode-editor-foreground); background-color: var(--vscode-editor-background); }
        .frame-input { margin-bottom: 20px; padding: 10px; border: 1px solid var(--vscode-widget-border); }
        .row { display: flex; gap: 10px; margin-bottom: 5px; }
        label { width: 20px; display: inline-block; }
        input { width: 60px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); }
        button { padding: 8px 16px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; cursor: pointer; }
        button:hover { background: var(--vscode-button-hoverBackground); }
        h3 { margin-top: 0; }
    </style>
</head>
<body>
    <h2>Frame Calculator</h2>
    
    <div class="frame-input" id="f1">
        <h3>Frame 1</h3>
        <div class="row">
            <label>X</label><input type="number" step="0.001" value="0">
            <label>Y</label><input type="number" step="0.001" value="0">
            <label>Z</label><input type="number" step="0.001" value="0">
        </div>
        <div class="row">
            <label>A</label><input type="number" step="0.001" value="0">
            <label>B</label><input type="number" step="0.001" value="0">
            <label>C</label><input type="number" step="0.001" value="0">
        </div>
    </div>

    <div class="actions">
        <button onclick="multiply()">F1 * F2</button>
        <button onclick="invert()">INV(F1)</button>
    </div>

    <div class="frame-input" id="f2">
        <h3>Frame 2</h3>
        <div class="row">
            <label>X</label><input type="number" step="0.001" value="0">
            <label>Y</label><input type="number" step="0.001" value="0">
            <label>Z</label><input type="number" step="0.001" value="0">
        </div>
        <div class="row">
            <label>A</label><input type="number" step="0.001" value="0">
            <label>B</label><input type="number" step="0.001" value="0">
            <label>C</label><input type="number" step="0.001" value="0">
        </div>
    </div>

    <div class="frame-input" id="result">
        <h3>Result</h3>
        <div class="row">
            <label>X</label><input type="number" readonly id="resX">
            <label>Y</label><input type="number" readonly id="resY">
            <label>Z</label><input type="number" readonly id="resZ">
        </div>
        <div class="row">
            <label>A</label><input type="number" readonly id="resA">
            <label>B</label><input type="number" readonly id="resB">
            <label>C</label><input type="number" readonly id="resC">
        </div>
        <br>
        <button onclick="copyResult()">Copy to Clipboard</button>
    </div>

    <script>
        function getFrame(id) {
            const inputs = document.querySelectorAll('#' + id + ' input');
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
            const inputs = document.querySelectorAll('#' + id + ' input');
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
            const A = toRad(f.a);
            const B = toRad(f.b);
            const C = toRad(f.c);
            
            const ca = Math.cos(A), sa = Math.sin(A);
            const cb = Math.cos(B), sb = Math.sin(B);
            const cc = Math.cos(C), sc = Math.sin(C);
            
            // KUKA Rotation: Rz(A) * Ry(B) * Rx(C)
            const r11 = ca*cb;
            const r12 = ca*sb*sc - sa*cc; 
            // R = [
            //  ca*cb,  ca*sb*sc - sa*cc,  ca*sb*cc + sa*sc
            //  sa*cb,  sa*sb*sc + ca*cc,  sa*sb*cc - ca*sc
            //  -sb,    cb*sc,             cb*cc
            // ]
            // Correct formula check:
            // Rz(A) = [ca -sa 0; sa ca 0; 0 0 1]
            // Ry(B) = [cb 0 sb; 0 1 0; -sb 0 cb]
            // Rx(C) = [1 0 0; 0 cc -sc; 0 sc cc]
            
            // Let's implement full matrix mult to be safe
            return [
                 ca*cb,  ca*sb*sc - sa*cc,  ca*sb*cc + sa*sc,  f.x,
                 sa*cb,  sa*sb*sc + ca*cc,  sa*sb*cc - ca*sc,  f.y,
                 -sb,    cb*sc,             cb*cc,             f.z,
                 0,      0,                 0,                 1
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

        function fromMatrix(M) {
            const r11 = M[0], r12 = M[1], r13 = M[2], x = M[3];
            const r21 = M[4], r22 = M[5], r23 = M[6], y = M[7];
            const r31 = M[8], r32 = M[9], r33 = M[10], z = M[11];
            
            const sy = Math.sqrt(r11*r11 + r21*r21);
            let a, b, c;
            
            if (sy > 1e-6) {
                b = Math.atan2(-r31, sy);
                a = Math.atan2(r21, r11);
                c = Math.atan2(r32, r33);
            } else {
                // Gimbal lock
                b = Math.atan2(-r31, sy);
                a = Math.atan2(-r23, r22);
                c = 0;
            }
            
            return {
                x: x, y: y, z: z,
                a: toDeg(a), b: toDeg(b), c: toDeg(c)
            };
        }

        function multiply() {
            const f1 = getFrame('f1');
            const f2 = getFrame('f2');
            const m1 = getMatrix(f1);
            const m2 = getMatrix(f2);
            const mRes = matMult(m1, m2);
            const fRes = fromMatrix(mRes);
            setFrame('result', fRes);
        }

        function invert() {
             // To implement
             // INV(T) = [R^T, -R^T * P]
             const f1 = getFrame('f1');
             const m = getMatrix(f1);
             // R is top left 3x3
             const r11=m[0], r12=m[1], r13=m[2];
             const r21=m[4], r22=m[5], r23=m[6];
             const r31=m[8], r32=m[9], r33=m[10];
             const px=m[3], py=m[7], pz=m[11];
             
             // R_inv = R^T
             const i11=r11, i12=r21, i13=r31;
             const i21=r12, i22=r22, i23=r32;
             const i31=r13, i32=r23, i33=r33;
             
             // P_inv = -R^T * P
             const ix = -(i11*px + i12*py + i13*pz);
             const iy = -(i21*px + i22*py + i23*pz);
             const iz = -(i31*px + i32*py + i33*pz);
             
             const mInv = [
                 i11, i12, i13, ix,
                 i21, i22, i23, iy,
                 i31, i32, i33, iz,
                 0, 0, 0, 1
             ];
             const fRes = fromMatrix(mInv);
             setFrame('result', fRes);
        }
        
        function copyResult() {
             const f = getFrame('result');
             const str = \`{X \${f.x.toFixed(3)},Y \${f.y.toFixed(3)},Z \${f.z.toFixed(3)},A \${f.a.toFixed(3)},B \${f.b.toFixed(3)},C \${f.c.toFixed(3)}}\`;
             
             // Using navigator.clipboard might fail in vscode webview if not focused or secure context?
             // Use vscode API messaging to copy?
             // Or try standard execCommand
             const el = document.createElement('textarea');
             el.value = str;
             document.body.appendChild(el);
             el.select();
             document.execCommand('copy');
             document.body.removeChild(el);
        }
    </script>
</body>
</html>`;
}
