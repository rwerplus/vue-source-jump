"use strict";

const { findObjectAfterKey } = require("../core/jsScan");
const { parseVueBlocks } = require("../core/sfcBlocks");
const { splitTopLevel } = require("../core/textUtils");
const {
  collectDynamicComponentImports,
  collectImports
} = require("../imports/importBindings");
const { resolveFileReferencePath } = require("../project/pathResolver");
const {
  matchesComponentName,
  toPascalCase
} = require("./componentNames");

function resolveComponentFromImports(text, tagName, currentFile, projectRoot, aliases, workspaceRoot, extensions) {
  const candidates = collectComponentCandidates(text);
  const importByLocalName = new Map();

  for (const item of candidates.imports) {
    importByLocalName.set(item.local, item.source);
  }

  for (const item of candidates.registrations) {
    if (matchesComponentName(item.name, tagName) || matchesComponentName(item.local, tagName)) {
      const source = item.source || importByLocalName.get(item.local);
      const target = source && resolveFileReferencePath(
        source,
        currentFile,
        projectRoot,
        aliases,
        workspaceRoot,
        extensions
      );

      if (target) {
        return target;
      }
    }
  }

  for (const item of candidates.imports) {
    if (matchesComponentName(item.local, tagName)) {
      const target = resolveFileReferencePath(
        item.source,
        currentFile,
        projectRoot,
        aliases,
        workspaceRoot,
        extensions
      );

      if (target) {
        return target;
      }
    }
  }

  return null;
}

function collectComponentCandidates(text) {
  const blocks = parseVueBlocks(text);
  const imports = [];
  const registrations = [];

  for (const block of blocks.scripts) {
    const content = text.slice(block.contentStart, block.contentEnd);

    imports.push(...collectImports(content));
    imports.push(...collectDynamicComponentImports(content));
    registrations.push(...collectRegisteredComponents(content));
  }

  return {
    imports,
    registrations
  };
}

function collectRegisteredComponents(content) {
  const registrations = [];
  const object = findObjectAfterKey(content, "components");

  if (!object) {
    return registrations;
  }

  for (const property of splitTopLevel(object.content)) {
    const part = property.trim();

    if (!part) {
      continue;
    }

    const dynamicSource = /import\s*\(\s*["']([^"']+)["']\s*\)/.exec(part);
    const quoted = /^["']([^"']+)["']\s*:\s*([A-Za-z_$][\w$]*)?/.exec(part);

    if (quoted) {
      registrations.push({
        name: quoted[1],
        local: quoted[2] || toPascalCase(quoted[1]),
        source: dynamicSource && dynamicSource[1]
      });
      continue;
    }

    const pair = /^([A-Za-z_$][\w$]*)\s*:\s*([A-Za-z_$][\w$]*)/.exec(part);

    if (pair) {
      registrations.push({
        name: pair[1],
        local: pair[2],
        source: dynamicSource && dynamicSource[1]
      });
      continue;
    }

    const shorthand = /^([A-Za-z_$][\w$]*)$/.exec(part);

    if (shorthand) {
      registrations.push({
        name: shorthand[1],
        local: shorthand[1],
        source: null
      });
    }
  }

  return registrations;
}

module.exports = {
  collectComponentCandidates,
  resolveComponentFromImports
};
