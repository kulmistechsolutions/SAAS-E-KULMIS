/**
 * Rebuild the Somali and Arabic dictionaries from the phrase tables.
 *
 * Phrases are translated once and applied to every generated key whose English
 * text matches. "Status" alone appears on fifty screens, so translating the
 * phrase rather than each key keeps one wording across the system.
 */
const fs = require("fs");
const path = require("path");
const SP = process.argv[2];
const gen = require(path.join(SP, "dict-all.json"));

const map = {};
for (const f of fs.readdirSync(SP).filter((n) => /^phrases\d*\.json$/.test(n)).sort()) {
  Object.assign(map, JSON.parse(fs.readFileSync(path.join(SP, f), "utf8")));
}
fs.writeFileSync(path.join(SP, "phrases-all.json"), JSON.stringify(map, null, 1));

const esc = (s) => JSON.stringify(s);
const isIdent = (k) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k);

function build(i) {
  const out = {};
  let hits = 0, total = 0;
  for (const [ns, keys] of Object.entries(gen)) {
    for (const [k, eng] of Object.entries(keys)) {
      total++;
      const tr = map[eng];
      if (tr && tr[i]) { (out[ns] ??= {})[k] = tr[i]; hits++; }
    }
  }
  return { out, hits, total };
}

function render(obj, lang, name) {
  const s = [
    'import type { PartialDictionary } from "./en";', "",
    "/**",
    " * Generated: the shared phrases translated once and applied to every key",
    " * whose English text matches. Regenerate with regen-i18n rather than",
    " * editing by hand, or the two will drift.",
    " *",
    " * Anything absent falls back to English at runtime.",
    " */",
    "export const " + name + ": PartialDictionary = {",
  ];
  for (const ns of Object.keys(obj).sort()) {
    s.push("  " + (isIdent(ns) ? ns : esc(ns)) + ": {");
    for (const [k, v] of Object.entries(obj[ns])) {
      s.push("    " + (isIdent(k) ? k : esc(k)) + ": " + esc(v) + ",");
    }
    s.push("  },");
  }
  s.push("};");
  fs.writeFileSync("src/lib/i18n/dictionaries/" + lang + "-generated.ts", s.join("\n") + "\n");
}

const so = build(0), ar = build(1);
render(so.out, "so", "soGenerated");
render(ar.out, "ar", "arGenerated");
console.log("phrases   : " + Object.keys(map).length);
console.log("Somali    : " + so.hits + "/" + so.total + " (" + (100 * so.hits / so.total).toFixed(1) + "%)");
console.log("Arabic    : " + ar.hits + "/" + ar.total + " (" + (100 * ar.hits / ar.total).toFixed(1) + "%)");
