"use strict";

const fs = require("fs");
const {
  escapeRegExp,
  firstNumber,
  splitTopLevel
} = require("../core/textUtils");
const {
  isVueFile,
  parseVueBlocks
} = require("../core/sfcBlocks");

function findTargetSymbolDefinition(file, importedName) {
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    return null;
  }

  if (importedName === "*" || (importedName === "default" && isVueFile(file))) {
    return 0;
  }

  const content = fs.readFileSync(file, "utf8");

  if (importedName === "default") {
    return findDefaultExportDefinition(content);
  }

  if (!importedName) {
    return null;
  }

  if (isVueFile(file)) {
    const blocks = parseVueBlocks(content);

    for (const block of blocks.scripts) {
      const scriptContent = content.slice(block.contentStart, block.contentEnd);
      const relative = findNamedExportDefinition(scriptContent, importedName);

      if (typeof relative === "number") {
        return block.contentStart + relative;
      }
    }

    return null;
  }

  return findNamedExportDefinition(content, importedName);
}

function findDefaultExportDefinition(content) {
  const match = /\bexport\s+default\b/.exec(content);

  if (!match) {
    return 0;
  }

  return match.index;
}

function findNamedExportDefinition(content, symbolName) {
  return firstNumber([
    findDirectExportDefinition(content, symbolName),
    findExportSpecifierDefinition(content, symbolName),
    findDeclarationLike(content, symbolName)
  ]);
}

function findDirectExportDefinition(content, symbolName) {
  const escaped = escapeRegExp(symbolName);
  const patterns = [
    new RegExp(`\\bexport\\s+(?:async\\s+)?function\\s+(${escaped})\\b`),
    new RegExp(`\\bexport\\s+class\\s+(${escaped})\\b`),
    new RegExp(`\\bexport\\s+(?:const|let|var)\\s+(${escaped})\\b`),
    new RegExp(`\\bexport\\s+(?:interface|type|enum)\\s+(${escaped})\\b`)
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(content);

    if (match) {
      return match.index + match[0].indexOf(symbolName);
    }
  }

  return null;
}

function findExportSpecifierDefinition(content, symbolName) {
  const exportRe = /\bexport\s*\{([\s\S]*?)\}(?:\s*from\s*["']([^"']+)["'])?/g;
  let match;

  while ((match = exportRe.exec(content))) {
    const specifiers = splitTopLevel(match[1]);
    let specifierOffset = 0;

    for (const specifier of specifiers) {
      const trimmed = specifier.trim();
      const leading = specifier.length - specifier.trimStart().length;
      const parsed = /^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/.exec(trimmed);

      if (parsed) {
        const exportedName = parsed[2] || parsed[1];
        const localName = parsed[1];

        if (exportedName === symbolName) {
          const declaration = findDeclarationLike(content, localName);

          if (typeof declaration === "number") {
            return declaration;
          }

          return match.index + match[0].indexOf(match[1]) + specifierOffset + leading;
        }
      }

      specifierOffset += specifier.length + 1;
    }
  }

  return null;
}

function findDeclarationLike(content, symbolName) {
  const escaped = escapeRegExp(symbolName);
  const patterns = [
    new RegExp(`\\b(?:async\\s+)?function\\s+(${escaped})\\b`),
    new RegExp(`\\bclass\\s+(${escaped})\\b`),
    new RegExp(`\\b(?:const|let|var)\\s+(${escaped})\\b`),
    new RegExp(`\\b(?:interface|type|enum)\\s+(${escaped})\\b`)
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(content);

    if (match) {
      return match.index + match[0].indexOf(symbolName);
    }
  }

  return null;
}

module.exports = {
  findTargetSymbolDefinition
};
