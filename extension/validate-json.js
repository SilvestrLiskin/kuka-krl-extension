const fs = require('fs');
const path = require('path');

const files = [
    'client/syntaxes/krl.tmLanguage.json',
    'client/snippets/krl.code-snippets',
    'client/themes/krl-tao-theme.json',
    'client/themes/krl-tao-darker-theme.json',
    'client/themes/krl-modern-dark-theme.json',
    'package.json'
];

console.log('=== JSON Validation ===\n');

let allValid = true;
files.forEach(file => {
    try {
        const content = fs.readFileSync(file, 'utf8');
        JSON.parse(content);
        console.log(`✓ ${file}: VALID`);
    } catch (e) {
        console.log(`✗ ${file}: INVALID - ${e.message}`);
        allValid = false;
    }
});

console.log('\n=== Summary ===');
console.log(allValid ? 'All files are valid!' : 'Some files have errors!');
process.exit(allValid ? 0 : 1);
