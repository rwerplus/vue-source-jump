"use strict";

const { findTemplateLocalDefinition } = require("./templateScope");
const { findVueSymbolDefinition } = require("./scriptDefinitions");

function findScriptNavigationAt(graph, offset) {
  if (!graph || !graph.blocks || !Array.isArray(graph.blocks.scripts)) {
    return null;
  }

  const scriptBlock = graph.blocks.scripts.find((block) =>
    offset >= block.contentStart && offset <= block.contentEnd
  );

  if (!scriptBlock) {
    return null;
  }

  const identifier = findScriptIdentifierAt(graph.text, scriptBlock, offset);

  if (!identifier) {
    return null;
  }

  const definitionOffset = findVueSymbolDefinition(graph.text, identifier.name);

  if (typeof definitionOffset !== "number") {
    return null;
  }

  const isDefinition = offset >= definitionOffset &&
    offset <= definitionOffset + identifier.name.length;

  if (isDefinition) {
    const templateReference = findFirstTemplateReference(graph, identifier.name);

    if (!templateReference) {
      return null;
    }

    return {
      name: identifier.name,
      kind: "template-reference",
      source: "template",
      reference: identifier,
      target: {
        start: templateReference.start,
        end: templateReference.end
      }
    };
  }

  return {
    name: identifier.name,
    kind: "script-symbol",
    source: "script",
    reference: identifier,
    target: {
      start: definitionOffset,
      end: definitionOffset + identifier.name.length
    }
  };
}

function findFirstTemplateReference(graph, name) {
  const references = graph.template && Array.isArray(graph.template.references)
    ? graph.template.references
    : [];
  const locals = graph.template && Array.isArray(graph.template.locals)
    ? graph.template.locals
    : [];

  return references.find((reference) =>
    reference.name === name &&
    !findTemplateLocalDefinition(locals, reference)
  ) || null;
}

function collectScriptIdentifierReferences(graph, name) {
  if (!graph || !graph.blocks || !Array.isArray(graph.blocks.scripts) || !name) {
    return [];
  }

  const references = [];

  for (const block of graph.blocks.scripts) {
    const content = graph.text.slice(block.contentStart, block.contentEnd);
    const pattern = new RegExp(`\\b${escapeRegExp(name)}\\b`, "g");
    let match;

    while ((match = pattern.exec(content))) {
      const start = block.contentStart + match.index;
      const end = start + name.length;

      if (!isOffsetInIgnoredScriptTrivia(graph.text, block, start)) {
        references.push({
          name,
          start,
          end,
          kind: "script"
        });
      }
    }
  }

  return references;
}

function findScriptMemberAccessAt(text, scriptBlock, offset) {
  const identifier = findScriptIdentifierAt(text, scriptBlock, offset);

  if (!identifier) {
    return null;
  }

  const beforeIdentifier = text.slice(scriptBlock.contentStart, identifier.start);
  const chainMatch = /([A-Za-z_$][\w$]*(?:\s*\??\.\s*[A-Za-z_$][\w$]*)*)\s*\??\.\s*$/.exec(beforeIdentifier);

  if (!chainMatch) {
    return null;
  }

  const chainStart = scriptBlock.contentStart + chainMatch.index;
  const chainText = chainMatch[1];
  const names = [];
  const nameRe = /[A-Za-z_$][\w$]*/g;
  let match;

  while ((match = nameRe.exec(chainText))) {
    names.push({
      name: match[0],
      start: chainStart + match.index,
      end: chainStart + match.index + match[0].length
    });
  }

  if (names.length === 0) {
    return null;
  }

  return {
    baseName: names[0].name,
    memberName: identifier.name,
    chain: names.map((item) => item.name).concat(identifier.name),
    start: names[0].start,
    end: identifier.end,
    memberStart: identifier.start,
    memberEnd: identifier.end
  };
}

function findScriptIdentifierAt(text, scriptBlock, offset) {
  if (offset < scriptBlock.contentStart || offset > scriptBlock.contentEnd) {
    return null;
  }

  if (isOffsetInIgnoredScriptTrivia(text, scriptBlock, offset)) {
    return null;
  }

  let start = offset;

  while (start > scriptBlock.contentStart && isIdentifierPart(text[start - 1] || "")) {
    start -= 1;
  }

  let end = offset;

  while (end < scriptBlock.contentEnd && isIdentifierPart(text[end] || "")) {
    end += 1;
  }

  if (start === end || !isIdentifierStart(text[start] || "")) {
    return null;
  }

  const name = text.slice(start, end);

  if (name === "this" || name === "true" || name === "false" || name === "null" || name === "undefined") {
    return null;
  }

  return {
    name,
    start,
    end
  };
}

function isOffsetInIgnoredScriptTrivia(text, scriptBlock, offset) {
  let quote = "";

  for (let index = scriptBlock.contentStart; index < offset; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    const previous = text[index - 1];

    if (quote) {
      if (char === quote && previous !== "\\") {
        quote = "";
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === "/" && next === "/") {
      const lineEnd = text.indexOf("\n", index + 2);

      if (lineEnd === -1 || offset < lineEnd) {
        return true;
      }

      index = lineEnd;
      continue;
    }

    if (char === "/" && next === "*") {
      const blockEnd = text.indexOf("*/", index + 2);

      if (blockEnd === -1 || offset < blockEnd + 2) {
        return true;
      }

      index = blockEnd + 1;
    }
  }

  return Boolean(quote);
}

function isIdentifierStart(char) {
  return /[A-Za-z_$]/.test(char);
}

function isIdentifierPart(char) {
  return /[A-Za-z0-9_$]/.test(char);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  collectScriptIdentifierReferences,
  findFirstTemplateReference,
  findScriptIdentifierAt,
  findScriptMemberAccessAt,
  findScriptNavigationAt
};
