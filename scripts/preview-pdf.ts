import { PDFParse } from "pdf-parse";
import fs from "fs";

const buf = fs.readFileSync("app/data/chineseGSATpdf/01-115學測國綜試卷.pdf");
const parser = new PDFParse();
const data = await parser.parse(buf);

fs.writeFileSync("scripts/pdf-preview.txt", data.text, "utf8");
console.log("頁數:", data.numpages);
console.log("字數:", data.text.length);
console.log("\n--- 前 2000 字 ---\n");
console.log(data.text.slice(0, 2000));
