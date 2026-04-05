const fs = require('fs');
const c = fs.readFileSync('plugin/index.js', 'utf8');
console.log('Has createRequire:', c.includes('createRequire'));
console.log('Has await import:', c.includes('await import'));
console.log('Has require runtime:', c.includes('./runtime'));
console.log('Has import runtime:', c.includes('import("./runtime'));
