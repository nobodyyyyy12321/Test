const { PDFParse } = require('pdf-parse');
const fs = require('fs');
const buf = fs.readFileSync('app/data/chineseGSATpdf/01-115學測國綜試卷.pdf');
const parser = new PDFParse();
parser.parse(buf).then(data => {
  fs.writeFileSync('scripts/pdf-preview.txt', data.text);
  process.stdout.write('頁數: ' + data.numpages + '\n');
  process.stdout.write('字數: ' + data.text.length + '\n');
  process.stdout.write('前3000字:\n' + data.text.slice(0, 3000) + '\n');
}).catch(e => process.stderr.write(String(e)));
