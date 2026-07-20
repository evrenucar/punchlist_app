// Generate the interactive review pages (focus grill, update overview, graph
// options) from one shared harness template + a specs file, so every page shares
// the exact same chips/notes/send-to-chat mechanism. Regenerate with:
//   node status/build-review-pages.mjs
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL(".", import.meta.url));
const template = await readFile(dir + "review-harness.template.html", "utf8");
const specs = JSON.parse(await readFile(dir + "review-specs.json", "utf8"));

for (const { key, spec } of specs) {
  if (!key || !spec) throw new Error("bad spec entry: " + JSON.stringify({ key }));
  const html = template.replace("__SPEC_JSON__", () => JSON.stringify(spec));
  await writeFile(dir + key + ".html", html);
  const items = spec.sections.reduce((n, s) => n + s.items.length, 0);
  console.log("wrote", key + ".html", "(" + spec.sections.length + " sections, " + items + " items)");
}
