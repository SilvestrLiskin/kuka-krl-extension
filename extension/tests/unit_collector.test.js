const { SymbolExtractor, stripComments, splitVarsRespectingBrackets } = require('../server/out/lib/collector');
const assert = require('assert');

console.log('Testing collector.ts...');

try {
    // Test stripComments
    assert.strictEqual(stripComments('abc;comment'), 'abc');
    assert.strictEqual(stripComments('abc "str;ing" ; comment'), 'abc "str;ing"');
    assert.strictEqual(stripComments(';comment'), '');
    console.log('✓ stripComments passed');

    // Test splitVarsRespectingBrackets
    const vars = splitVarsRespectingBrackets('a, b[1,2], c="x,y"');
    assert.deepStrictEqual(vars, ['a', 'b[1,2]', 'c="x,y"']);
    console.log('✓ splitVarsRespectingBrackets passed');

    // Test SymbolExtractor
    const extractor = new SymbolExtractor();
    const text = `
    DECL INT i
    GLOBAL DECL REAL r = 1.0
    DECL INT a, b
    DECL STRING s = "Hello; World"
    `;
    extractor.extractFromText(text);
    const variables = extractor.getVariables();

    assert.ok(variables.find(v => v.name === 'i' && v.scope === 'LOCAL'), 'Local i failed');
    assert.ok(variables.find(v => v.name === 'r' && v.scope === 'GLOBAL'), 'Global r failed');
    assert.ok(variables.find(v => v.name === 'a' && v.scope === 'LOCAL'), 'Local a failed');
    assert.ok(variables.find(v => v.name === 'b' && v.scope === 'LOCAL'), 'Local b failed');
    const s = variables.find(v => v.name === 's');
    assert.ok(s, 's found');
    assert.strictEqual(s.value, '"Hello; World"', 's value failed');
    console.log('✓ SymbolExtractor passed');
} catch (e) {
    console.error('Test Failed:', e);
    process.exit(1);
}
