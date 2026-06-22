"use strict";

const fs = require("fs");
const path = require("path");
const { unique } = require("../core/textUtils");

const DEFAULT_ALIASES = {
  "@": "src",
  "~": "src"
};

const DEFAULT_EXTENSIONS = [
  ".mjs",
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".json",
  ".vue",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".ico",
  ".bmp",
  ".avif",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".styl",
  ".md"
];

function resolveFileReferencePath(rawPath, currentFile, projectRoot, aliases, workspaceRoot, extensions) {
  const cleaned = stripPathQueryOrHash(String(rawPath || "")).replace(/\\/g, path.sep);

  if (!cleaned) {
    return null;
  }

  const aliased = resolveAliasPaths(cleaned, projectRoot, aliases, workspaceRoot);
  const aliasLike = isAliasLikePath(cleaned, aliases);

  if (aliasLike) {
    for (const candidate of aliased) {
      const resolved = resolveExistingFile(candidate, extensions);

      if (resolved) {
        return resolved;
      }
    }

    return null;
  }

  if (aliased.length === 0 && isBarePackagePath(cleaned)) {
    return null;
  }

  const roots = [];

  roots.push(...aliased);

  if (path.isAbsolute(cleaned) && aliased.length === 0) {
    roots.push(cleaned);
  } else if (cleaned.startsWith(".") || cleaned.startsWith(`..${path.sep}`)) {
    roots.push(path.resolve(path.dirname(currentFile), cleaned));
  } else {
    if (projectRoot) {
      roots.push(path.resolve(projectRoot, cleaned));
    }

    if (workspaceRoot && workspaceRoot !== projectRoot) {
      roots.push(path.resolve(workspaceRoot, cleaned));
    }
  }

  for (const candidate of roots) {
    const resolved = resolveExistingFile(candidate, extensions);

    if (resolved) {
      return resolved;
    }
  }

  return null;
}

function stripPathQueryOrHash(value) {
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if ((char === "?" || char === "#") && index > 0) {
      return value.slice(0, index);
    }
  }

  return value;
}

function isAliasLikePath(value, aliases) {
  const normalized = value.replace(/\\/g, "/");
  const prefixes = collectAliasPrefixes(aliases);

  return prefixes.some(
    (alias) => normalized === alias || normalized.startsWith(`${alias}/`)
  );
}

function collectAliasPrefixes(aliases) {
  const configured = aliases && typeof aliases === "object"
    ? Object.keys(aliases)
    : [];

  return unique([
    ...configured,
    ...Object.keys(DEFAULT_ALIASES),
    "/@",
    "@",
    "~"
  ])
    .map((value) => String(value || "").trim().replace(/\\/g, "/").replace(/\/+$/g, ""))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
}

function resolveAliasPaths(value, projectRoot, aliases, workspaceRoot) {
  if (!projectRoot || !aliases || typeof aliases !== "object") {
    return [];
  }

  const matches = [];
  const bases = unique([projectRoot, workspaceRoot].filter(Boolean));
  const sortedAliases = Object.keys(aliases).sort((a, b) => b.length - a.length);

  for (const alias of sortedAliases) {
    const target = aliases[alias];
    const normalizedAlias = alias.replace(/\\/g, "/");
    const normalizedValue = value.replace(/\\/g, "/");

    if (normalizedValue === normalizedAlias || normalizedValue.startsWith(`${normalizedAlias}/`)) {
      const rest = normalizedValue.slice(normalizedAlias.length).replace(/^[/\\]+/, "");

      for (const base of bases) {
        const root = path.isAbsolute(target)
          ? target
          : path.resolve(base, String(target));

        matches.push(path.resolve(root, rest));
      }
    }
  }

  return unique(matches);
}

function resolveExistingFile(candidate, extensions) {
  const resolvedExtensions = normalizeExtensions(extensions || DEFAULT_EXTENSIONS);
  const attempts = [candidate];
  const ext = path.extname(candidate);

  if (!ext) {
    for (const extension of resolvedExtensions) {
      attempts.push(candidate + extension);
    }

    for (const extension of resolvedExtensions) {
      attempts.push(path.join(candidate, `index${extension}`));
    }
  }

  for (const attempt of attempts) {
    if (fs.existsSync(attempt) && fs.statSync(attempt).isFile()) {
      return attempt;
    }
  }

  return null;
}

function normalizeExtensions(extensions) {
  const list = Array.isArray(extensions) ? extensions : DEFAULT_EXTENSIONS;

  return unique(
    list
      .map((extension) => String(extension || "").trim())
      .filter(Boolean)
      .map((extension) => (extension.startsWith(".") ? extension : `.${extension}`))
  );
}

function isBarePackagePath(value) {
  return !(
    path.isAbsolute(value) ||
    value.startsWith(".") ||
    value.startsWith("@") ||
    value.startsWith("~") ||
    /^[A-Za-z0-9_-]+[\\/]/.test(value)
  );
}

module.exports = {
  DEFAULT_ALIASES,
  DEFAULT_EXTENSIONS,
  collectAliasPrefixes,
  isAliasLikePath,
  normalizeExtensions,
  resolveFileReferencePath
};
