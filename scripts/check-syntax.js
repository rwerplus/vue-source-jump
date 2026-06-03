"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CHECK_DIRS = ["src", "test", "scripts"];

function collectJavaScriptFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectJavaScriptFiles(absolute));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(absolute);
    }
  }

  return files;
}

const files = CHECK_DIRS.flatMap((dir) =>
  collectJavaScriptFiles(path.join(ROOT, dir))
);

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    cwd: ROOT,
    encoding: "utf8"
  });

  if (result.status !== 0) {
    process.stdout.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    process.exit(result.status || 1);
  }
}

console.log(`Checked ${files.length} JavaScript files.`);
