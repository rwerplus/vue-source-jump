"use strict";

const { parseVueBlocks } = require("../core/sfcBlocks");
const { parseTemplateExpressions } = require("./templateExpressions");
const {
  findTemplateLocalDeclarationAt,
  findTemplateLocalDefinition
} = require("./templateScope");
const { findVueSymbolDefinition } = require("./scriptDefinitions");

function buildVueSymbolGraph(text) {
  const blocks = parseVueBlocks(text);
  const template = parseTemplateExpressions(text, blocks.template);

  return {
    text,
    blocks,
    template
  };
}

function findVueDefinitionAt(graph, offset) {
  if (!graph || !graph.blocks || !graph.blocks.template) {
    return null;
  }

  if (!isInside(offset, graph.blocks.template)) {
    return null;
  }

  const localDeclaration = findTemplateLocalDeclarationAt(
    graph.template.locals,
    offset
  );

  if (localDeclaration) {
    return {
      name: localDeclaration.name,
      kind: "template-local",
      source: localDeclaration.kind,
      reference: null,
      target: {
        start: localDeclaration.start,
        end: localDeclaration.end
      }
    };
  }

  const reference = findTemplateReferenceAt(graph, offset);

  if (!reference) {
    return null;
  }

  const local = findTemplateLocalDefinition(graph.template.locals, reference);

  if (local) {
    return {
      name: reference.name,
      kind: "template-local",
      source: local.kind,
      reference,
      target: {
        start: local.start,
        end: local.end
      }
    };
  }

  const scriptOffset = findVueSymbolDefinition(graph.text, reference.name);

  if (typeof scriptOffset !== "number") {
    return null;
  }

  return {
    name: reference.name,
    kind: "script-symbol",
    source: "script",
    reference,
    target: {
      start: scriptOffset,
      end: scriptOffset + reference.name.length
    }
  };
}

function findTemplateReferenceAt(graph, offset) {
  const references = graph.template && Array.isArray(graph.template.references)
    ? graph.template.references
    : [];
  const matches = references
    .filter((reference) => offset >= reference.start && offset <= reference.end)
    .sort((a, b) => (a.end - a.start) - (b.end - b.start));

  return matches[0] || null;
}

function isInside(offset, block) {
  return offset >= block.contentStart && offset <= block.contentEnd;
}

module.exports = {
  buildVueSymbolGraph,
  findTemplateReferenceAt,
  findVueDefinitionAt
};
