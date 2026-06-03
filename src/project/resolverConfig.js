"use strict";

const fs = require("fs");
const path = require("path");
const {
  collectStringLiterals,
  findMatchingBrace,
  splitTopLevel,
  stripJsonCommentsAndTrailingCommas,
  unique
} = require("../core/textUtils");
const {
  findPropertyExpression,
  findStructuredValueAfterKey
} = require("../core/jsScan");
const {
  DEFAULT_ALIASES,
  DEFAULT_EXTENSIONS,
  normalizeExtensions
} = require("./pathResolver");

function findProjectRoot(currentFile, workspaceRoot) {
  const markers = [
    "vite.config.js",
    "vite.config.ts",
    "vite.config.mjs",
    "vite.config.cjs",
    "vue.config.js",
    "nuxt.config.js",
    "nuxt.config.ts",
    "tsconfig.json",
    "jsconfig.json",
    "package.json"
  ];
  let dir = fs.existsSync(currentFile) && fs.statSync(currentFile).isDirectory()
    ? currentFile
    : path.dirname(currentFile);
  const normalizedWorkspaceRoot = workspaceRoot && path.resolve(workspaceRoot);
  let packageJsonRoot = null;

  while (dir && dir !== path.dirname(dir)) {
    for (const marker of markers) {
      const markerPath = path.join(dir, marker);

      if (!fs.existsSync(markerPath)) {
        continue;
      }

      if (marker === "package.json") {
        packageJsonRoot = packageJsonRoot || dir;
        continue;
      }

      return dir;
    }

    if (normalizedWorkspaceRoot && path.resolve(dir) === normalizedWorkspaceRoot) {
      break;
    }

    dir = path.dirname(dir);
  }

  return packageJsonRoot || normalizedWorkspaceRoot || path.dirname(currentFile);
}

function loadProjectResolverConfig(projectRoot, userConfig, workspaceRoot) {
  const config = userConfig || {};
  const viteConfig = readViteResolverConfig(projectRoot);
  const tsConfig = readTsJsResolverConfig(projectRoot);
  const aliases = Object.assign(
    {},
    DEFAULT_ALIASES,
    tsConfig.aliases,
    viteConfig.aliases,
    config.aliases || {}
  );
  const extensions = normalizeExtensions([
    ...viteConfig.extensions,
    ...DEFAULT_EXTENSIONS
  ]);

  return {
    aliases,
    extensions,
    configFiles: unique([
      ...tsConfig.configFiles,
      ...viteConfig.configFiles
    ]),
    workspaceRoot
  };
}

function readViteResolverConfig(projectRoot) {
  const result = {
    aliases: {},
    extensions: [],
    configFiles: []
  };

  if (!projectRoot) {
    return result;
  }

  const configFile = [
    "vite.config.ts",
    "vite.config.js",
    "vite.config.mjs",
    "vite.config.cjs",
    "vitest.config.ts",
    "vitest.config.js"
  ]
    .map((file) => path.join(projectRoot, file))
    .find((file) => fs.existsSync(file));

  if (!configFile) {
    return result;
  }

  result.configFiles.push(configFile);

  const content = fs.readFileSync(configFile, "utf8");
  const resolveValue = findStructuredValueAfterKey(content, "resolve");

  if (!resolveValue || resolveValue.kind !== "object") {
    return result;
  }

  const aliasValue = findStructuredValueAfterKey(resolveValue.content, "alias");

  if (aliasValue && aliasValue.kind === "object") {
    Object.assign(
      result.aliases,
      parseViteAliasObject(aliasValue.content, projectRoot)
    );
  } else if (aliasValue && aliasValue.kind === "array") {
    Object.assign(
      result.aliases,
      parseViteAliasArray(aliasValue.content, projectRoot)
    );
  }

  const extensionsValue = findStructuredValueAfterKey(
    resolveValue.content,
    "extensions"
  );

  if (extensionsValue && extensionsValue.kind === "array") {
    result.extensions.push(...collectStringLiterals(extensionsValue.content));
  }

  return result;
}

function parseViteAliasObject(content, projectRoot) {
  const aliases = {};

  for (const property of splitTopLevel(content)) {
    const parsed = parseObjectProperty(property);

    if (!parsed) {
      continue;
    }

    const replacement = parseAliasReplacementExpression(
      parsed.value,
      projectRoot
    );

    if (replacement) {
      aliases[parsed.key] = replacement;
    }
  }

  return aliases;
}

function parseViteAliasArray(content, projectRoot) {
  const aliases = {};
  const objects = collectTopLevelObjects(content);

  for (const objectContent of objects) {
    const findValue = findPropertyExpression(objectContent, "find");
    const replacementValue = findPropertyExpression(objectContent, "replacement");
    const alias = findValue && parseAliasFindExpression(findValue);
    const replacement = replacementValue && parseAliasReplacementExpression(
      replacementValue,
      projectRoot
    );

    if (alias && replacement) {
      aliases[alias] = replacement;
    }
  }

  return aliases;
}

function readTsJsResolverConfig(projectRoot) {
  const result = {
    aliases: {},
    configFiles: []
  };

  if (!projectRoot) {
    return result;
  }

  const configNames = [
    "tsconfig.json",
    "tsconfig.app.json",
    "tsconfig.base.json",
    "jsconfig.json"
  ];

  for (const name of configNames) {
    const file = path.join(projectRoot, name);

    if (!fs.existsSync(file)) {
      continue;
    }

    const parsed = readJsonConfigFile(file);

    if (!parsed) {
      continue;
    }

    result.configFiles.push(...parsed.files);
    Object.assign(
      result.aliases,
      parseTsConfigPathAliases(parsed.config, path.dirname(file))
    );
  }

  result.configFiles = unique(result.configFiles);
  return result;
}

function parseTsConfigPathAliases(config, configDir) {
  const compilerOptions = (config && config.compilerOptions) || {};
  const paths = compilerOptions.paths || {};
  const baseUrl = compilerOptions.baseUrl || ".";
  const aliases = {};

  for (const key of Object.keys(paths)) {
    const targets = paths[key];
    const firstTarget = Array.isArray(targets) && targets[0];

    if (!firstTarget) {
      continue;
    }

    const alias = stripPathWildcard(key);
    const target = stripPathWildcard(firstTarget);
    const root = path.resolve(configDir, baseUrl, target);

    aliases[alias] = root;
  }

  return aliases;
}

function readJsonConfigFile(file, seen) {
  const visited = seen || new Set();

  if (visited.has(file)) {
    return null;
  }

  visited.add(file);

  try {
    const raw = fs.readFileSync(file, "utf8");
    const config = JSON.parse(stripJsonCommentsAndTrailingCommas(raw));
    const files = [file];

    if (config.extends) {
      const baseFile = resolveExtendsConfig(config.extends, path.dirname(file));
      const base = baseFile && fs.existsSync(baseFile)
        ? readJsonConfigFile(baseFile, visited)
        : null;

      if (base) {
        return {
          config: mergeTsConfig(base.config, config),
          files: unique([...base.files, ...files])
        };
      }
    }

    return {
      config,
      files
    };
  } catch (error) {
    return null;
  }
}

function resolveExtendsConfig(value, configDir) {
  if (!value || typeof value !== "string") {
    return null;
  }

  if (!value.startsWith(".") && !path.isAbsolute(value)) {
    return null;
  }

  const resolved = path.resolve(configDir, value);

  if (path.extname(resolved)) {
    return resolved;
  }

  return `${resolved}.json`;
}

function mergeTsConfig(base, child) {
  const baseCompiler = base.compilerOptions || {};
  const childCompiler = child.compilerOptions || {};

  return Object.assign({}, base, child, {
    compilerOptions: Object.assign({}, baseCompiler, childCompiler, {
      paths: Object.assign({}, baseCompiler.paths || {}, childCompiler.paths || {})
    })
  });
}

function parseObjectProperty(rawProperty) {
  const property = rawProperty.trim();
  const quoted = /^["']([^"']+)["']\s*:\s*([\s\S]+)$/.exec(property);

  if (quoted) {
    return {
      key: quoted[1],
      value: quoted[2].trim()
    };
  }

  const bare = /^([A-Za-z_$][\w$]*)\s*:\s*([\s\S]+)$/.exec(property);

  if (bare) {
    return {
      key: bare[1],
      value: bare[2].trim()
    };
  }

  return null;
}

function parseAliasFindExpression(expression) {
  const literal = /^["']([^"']+)["']/.exec(expression.trim());

  return literal ? literal[1] : null;
}

function parseAliasReplacementExpression(expression, projectRoot) {
  const value = expression.trim().replace(/\s+as\s+string\s*$/, "");
  const pathCall = /path\.(?:resolve|join)\s*\(\s*__dirname\s*,\s*([^)]+)\)/.exec(value);

  if (pathCall) {
    const parts = collectStringLiterals(pathCall[1]);

    if (parts.length > 0) {
      return path.resolve(projectRoot, ...parts);
    }
  }

  const urlCall = /new\s+URL\s*\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url\s*\)/.exec(value);

  if (urlCall) {
    return path.resolve(projectRoot, urlCall[1]);
  }

  const literal = /^["']([^"']+)["']/.exec(value);

  if (!literal) {
    return null;
  }

  return resolveConfigPathValue(literal[1], projectRoot);
}

function resolveConfigPathValue(value, projectRoot) {
  if (path.isAbsolute(value)) {
    return value;
  }

  if (value.startsWith("/")) {
    return path.resolve(projectRoot, value.slice(1));
  }

  return path.resolve(projectRoot, value);
}

function collectTopLevelObjects(content) {
  const objects = [];

  for (let index = 0; index < content.length; index += 1) {
    if (content[index] !== "{") {
      continue;
    }

    const end = findMatchingBrace(content, index);

    if (end === -1) {
      continue;
    }

    objects.push(content.slice(index + 1, end));
    index = end;
  }

  return objects;
}

function stripPathWildcard(value) {
  return String(value || "").replace(/\/?\*$/, "");
}

module.exports = {
  findProjectRoot,
  loadProjectResolverConfig
};
