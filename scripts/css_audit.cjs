/* audits every app component's className literals against the built css */
const fs = require("fs");
const path = require("path");

const adir = path.join(process.cwd(), "build", "assets");
const css = fs.readdirSync(adir).filter((f) => f.endsWith(".css")).map((f) => fs.readFileSync(path.join(adir, f), "utf8")).join("\n");
const cssFlat = css.replace(/\s+/g, "");

const files = process.argv.slice(2);
let report = {};
for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const classes = new Set();
  // static className="..." and template `...`
  for (const m of src.matchAll(/className="([^"]+)"/g)) {
    m[1].split(/\s+/).forEach((c) => c && classes.add(c));
  }
  for (const m of src.matchAll(/className=\{`([^`]+)`\}/g)) {
    m[1].replace(/\$\{[^}]*\}/g, "").split(/\s+/).forEach((c) => c && classes.add(c));
  }
  // also data- attrs sometimes styled; skip. Filter framework classes:
  const KNOWN = new Set(["floatTab", "dpShad", "restWindow", "windowScreen", "flex", "flex-col", "flex-grow", "overflow-hidden", "win11Scroll", "h-full", "w-full", "box-border", "text-gray-100", "items-center", "flex-col", "relative", "handcr", "prtclk", "uicon", "winBtn", "ghost", "on", "done", "content", "p-6", "px-6", "py-4", "mx-4", "pt-2", "pl-2", "pb-1", "text-xl", "font-semibold", "gap-2", "mdShad", "ltShad", "extraApp", "extraFill"]);
  const missing = [];
  for (const c of classes) {
    if (KNOWN.has(c)) continue;
    if (!cssFlat.includes("." + c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))) missing.push(c);
  }
  if (missing.length) report[file] = missing;
}
for (const [f, miss] of Object.entries(report)) {
  console.log("\n" + path.relative(process.cwd(), f) + "  (" + miss.length + " missing):");
  console.log("  " + miss.join(", "));
}
const total = Object.values(report).reduce((a, m) => a + m.length, 0);
console.log("\n=== " + (total ? total + " missing classes across " + Object.keys(report).length + " files" : "ALL CLASSES COVERED") + " ===");
