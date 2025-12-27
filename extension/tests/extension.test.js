/**
 * KRL Extension Tests
 * Run with: node tests/extension.test.js
 */

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function test(description, fn) {
    try {
        fn();
        console.log(`✓ ${description}`);
        passed++;
    } catch (e) {
        console.log(`✗ ${description}`);
        console.log(`  Error: ${e.message}`);
        failed++;
    }
}

function assertEqual(actual, expected, msg) {
    if (actual !== expected) {
        throw new Error(msg || `Expected ${expected}, got ${actual}`);
    }
}

function assertTrue(condition, msg) {
    if (!condition) {
        throw new Error(msg || 'Condition is false');
    }
}

console.log('=== KRL Extension Tests ===\n');

// Test 1: Grammar file structure
console.log('--- Grammar Tests ---');

test('Grammar file exists', () => {
    const grammarPath = path.join(__dirname, '..', 'client', 'syntaxes', 'krl.tmLanguage.json');
    assertTrue(fs.existsSync(grammarPath), 'Grammar file not found');
});

test('Grammar has correct scopeName', () => {
    const grammar = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'client', 'syntaxes', 'krl.tmLanguage.json'), 'utf8'));
    assertEqual(grammar.scopeName, 'source.krl');
});

test('Grammar contains KRL keywords', () => {
    const grammar = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'client', 'syntaxes', 'krl.tmLanguage.json'), 'utf8'));
    const content = JSON.stringify(grammar);
    assertTrue(content.includes('PTP'), 'PTP keyword missing');
    assertTrue(content.includes('LIN'), 'LIN keyword missing');
    assertTrue(content.includes('CIRC'), 'CIRC keyword missing');
    assertTrue(content.includes('DECL'), 'DECL keyword missing');
    assertTrue(content.includes('E6POS'), 'E6POS type missing');
});

test('Grammar contains new keywords from Reference Guide', () => {
    const grammar = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'client', 'syntaxes', 'krl.tmLanguage.json'), 'utf8'));
    const content = JSON.stringify(grammar);
    assertTrue(content.includes('IMPORT'), 'IMPORT keyword missing');
    assertTrue(content.includes('MAXIMUM'), 'MAXIMUM keyword missing');
    assertTrue(content.includes('CHANNEL'), 'CHANNEL keyword missing');
});

test('Grammar contains system variables', () => {
    const grammar = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'client', 'syntaxes', 'krl.tmLanguage.json'), 'utf8'));
    const content = JSON.stringify(grammar);
    assertTrue(content.includes('VEL'), 'VEL missing');
    assertTrue(content.includes('ACC'), 'ACC missing');
    assertTrue(content.includes('BASE'), 'BASE missing');
    assertTrue(content.includes('TOOL'), 'TOOL missing');
});

test('Grammar contains OpenKuka.KRL enums', () => {
    const grammar = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'client', 'syntaxes', 'krl.tmLanguage.json'), 'utf8'));
    const content = JSON.stringify(grammar);
    assertTrue(content.includes('P_FREE'), '#P_FREE enum missing');
    assertTrue(content.includes('P_ACTIVE'), '#P_ACTIVE enum missing');
    assertTrue(content.includes('CMD_OK'), '#CMD_OK enum missing');
});

// Test 2: Snippets
console.log('\n--- Snippets Tests ---');

test('Snippets file exists', () => {
    const snippetsPath = path.join(__dirname, '..', 'client', 'snippets', 'krl.code-snippets');
    assertTrue(fs.existsSync(snippetsPath), 'Snippets file not found');
});

test('Snippets file is valid JSON', () => {
    const snippetsPath = path.join(__dirname, '..', 'client', 'snippets', 'krl.code-snippets');
    const snippets = JSON.parse(fs.readFileSync(snippetsPath, 'utf8'));
    assertTrue(typeof snippets === 'object', 'Snippets is not an object');
});

test('Snippets contain motion commands', () => {
    const snippets = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'client', 'snippets', 'krl.code-snippets'), 'utf8'));
    const keys = Object.keys(snippets);
    assertTrue(keys.length > 50, `Expected more than 50 snippets, got ${keys.length}`);
});

test('Snippets contain COPEN/CREAD/CWRITE', () => {
    const snippets = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'client', 'snippets', 'krl.code-snippets'), 'utf8'));
    const content = JSON.stringify(snippets);
    assertTrue(content.includes('COPEN'), 'COPEN snippet missing');
    assertTrue(content.includes('CREAD'), 'CREAD snippet missing');
    assertTrue(content.includes('CWRITE'), 'CWRITE snippet missing');
});

test('Snippets contain E6POS/E6AXIS declarations', () => {
    const snippets = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'client', 'snippets', 'krl.code-snippets'), 'utf8'));
    assertTrue(snippets['E6POS Declaration'], 'E6POS Declaration snippet missing');
    assertTrue(snippets['E6AXIS Declaration'], 'E6AXIS Declaration snippet missing');
});

// Test 3: Themes
console.log('\n--- Theme Tests ---');

test('Tao Theme exists', () => {
    const themePath = path.join(__dirname, '..', 'client', 'themes', 'krl-tao-theme.json');
    assertTrue(fs.existsSync(themePath), 'Tao Theme not found');
});

test('Tao Theme has KRL-specific rules', () => {
    const theme = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'client', 'themes', 'krl-tao-theme.json'), 'utf8'));
    const content = JSON.stringify(theme);
    assertTrue(content.includes('keyword.function.movement.krl'), 'Movement keyword scope missing');
    assertTrue(content.includes('variable.language.system.krl'), 'System variable scope missing');
});

test('All themes are valid JSON', () => {
    const themesDir = path.join(__dirname, '..', 'client', 'themes');
    const themes = fs.readdirSync(themesDir).filter(f => f.endsWith('.json'));
    themes.forEach(theme => {
        JSON.parse(fs.readFileSync(path.join(themesDir, theme), 'utf8'));
    });
    assertTrue(themes.length >= 7, `Expected at least 7 themes, got ${themes.length}`);
});

// Test 4: Package.json
console.log('\n--- Package Tests ---');

test('Package.json version is 1.5.0', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    assertEqual(pkg.version, '1.5.0');
});

test('Package.json has all themes registered', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    const themes = pkg.contributes.themes;
    assertTrue(themes.length >= 7, `Expected at least 7 themes, got ${themes.length}`);
    const labels = themes.map(t => t.label);
    assertTrue(labels.includes('KRL Tao'), 'KRL Tao theme not registered');
    assertTrue(labels.includes('KRL Tao Dark'), 'KRL Tao Dark theme not registered');
});

test('Package.json has KRL language definition', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    const languages = pkg.contributes.languages;
    assertTrue(languages.length > 0, 'No languages defined');
    assertTrue(languages[0].id === 'krl', 'KRL language not defined');
});

// Test 5: Wonderlib Functions
console.log('\n--- Wonderlib Tests ---');

test('Wonderlib functions file exists', () => {
    const wonderlibPath = path.join(__dirname, '..', 'server', 'src', 'lib', 'wonderlibFunctions.ts');
    assertTrue(fs.existsSync(wonderlibPath), 'wonderlibFunctions.ts not found');
});

test('Wonderlib contains expected functions', () => {
    const content = fs.readFileSync(path.join(__dirname, '..', 'server', 'src', 'lib', 'wonderlibFunctions.ts'), 'utf8');
    assertTrue(content.includes('DISTANCE_POINT_POINT'), 'DISTANCE_POINT_POINT missing');
    assertTrue(content.includes('SPRINTF'), 'SPRINTF missing');
    assertTrue(content.includes('IN_RANGE'), 'IN_RANGE missing');
});

// Summary
console.log('\n=== Test Summary ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total: ${passed + failed}`);

process.exit(failed > 0 ? 1 : 0);
