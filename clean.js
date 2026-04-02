const fs = require('fs');
let txt = fs.readFileSync('build_plain2.txt', 'utf8');
txt = txt.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').replace(/\r/g, '');
fs.writeFileSync('clean.log', txt);
