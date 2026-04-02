const fs = require('fs');
let txt = '';
try {
  txt = fs.readFileSync('build_plain3.txt', 'utf8');
} catch (e) {
  process.exit(0);
}
txt = txt.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').replace(/\r/g, '');
fs.writeFileSync('clean3.log', txt);
