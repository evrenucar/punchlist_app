import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(root, "src");
const outputPath = path.join(root, "outputs", "task-board.html");

const [template, css, script] = await Promise.all([
  readFile(path.join(sourceDir, "task-board.html"), "utf8"),
  readFile(path.join(sourceDir, "task-board.css"), "utf8"),
  readFile(path.join(sourceDir, "task-board.js"), "utf8"),
]);

if (!template.includes("<!-- TASK_BOARD_STYLES -->") || !template.includes("<!-- TASK_BOARD_SCRIPT -->")) {
  throw new Error("task-board template is missing build markers");
}

const output = template
  .replace("<!-- TASK_BOARD_STYLES -->", `<style data-task-board-styles>\n${css.trimEnd()}\n  </style>`)
  .replace("<!-- TASK_BOARD_SCRIPT -->", `<script data-task-board-script>\n${script.trimEnd()}\n  </script>`);

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, output, "utf8");

console.log(`Built ${path.relative(root, outputPath)}`);
