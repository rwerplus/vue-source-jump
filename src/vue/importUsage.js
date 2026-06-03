"use strict";

const { findImportBindingByLocalName } = require("../imports/importBindings");
const { findScriptIdentifierAt } = require("./scriptReferences");
const { findTemplateLocalDefinition } = require("./templateScope");
const { findTemplateReferenceAt } = require("./symbolGraph");

function findImportedSymbolUsageAt(text, offset, blocks, graph) {
  const identifier = findImportedUsageIdentifier(text, offset, blocks, graph);

  if (!identifier) {
    return null;
  }

  const binding = findImportBindingByLocalName(text, identifier.name);

  if (!binding) {
    return null;
  }

  return {
    identifier,
    binding
  };
}

function findImportedUsageIdentifier(text, offset, blocks, graph) {
  const scriptBlock = blocks.scripts.find((block) =>
    offset >= block.contentStart && offset <= block.contentEnd
  );

  if (scriptBlock) {
    return findScriptIdentifierAt(text, scriptBlock, offset);
  }

  if (
    !blocks.template ||
    offset < blocks.template.contentStart ||
    offset > blocks.template.contentEnd
  ) {
    return null;
  }

  const reference = findTemplateReferenceAt(graph, offset);

  if (!reference) {
    return null;
  }

  if (findTemplateLocalDefinition(graph.template.locals, reference)) {
    return null;
  }

  return reference;
}

module.exports = {
  findImportedSymbolUsageAt
};
