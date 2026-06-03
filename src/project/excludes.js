"use strict";

const path = require("path");

const DEFAULT_EXCLUDED_DIRECTORIES = [
  "node_modules",
  "dist",
  "build",
  ".git",
  ".output",
  ".vite",
  "coverage"
];

function normalizeExcludedDirectories(value) {
  const list = Array.isArray(value) && value.length > 0
    ? value
    : DEFAULT_EXCLUDED_DIRECTORIES;

  return Array.from(new Set(
    list
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .map((item) => item.replace(/^[/\\]+|[/\\]+$/g, ""))
      .filter(Boolean)
  ));
}

function createWorkspaceExcludeGlob(value) {
  const directories = normalizeExcludedDirectories(value)
    .map((item) => item.replace(/\\/g, "/"));

  if (directories.length === 0) {
    return undefined;
  }

  return `**/{${directories.join(",")}}/**`;
}

function isPathInsideExcludedDirectory(file, excludedDirectories) {
  const directories = normalizeExcludedDirectories(excludedDirectories)
    .map((item) => item.toLowerCase());
  const parts = String(file || "")
    .split(/[\\/]+/)
    .map((part) => part.toLowerCase());

  return parts.some((part) => directories.includes(part));
}

function trimProjectRelativePath(value) {
  return String(value || "")
    .replace(/^[/\\]+|[/\\]+$/g, "")
    .split(/[\\/]+/)
    .join(path.sep);
}

module.exports = {
  DEFAULT_EXCLUDED_DIRECTORIES,
  createWorkspaceExcludeGlob,
  isPathInsideExcludedDirectory,
  normalizeExcludedDirectories,
  trimProjectRelativePath
};
