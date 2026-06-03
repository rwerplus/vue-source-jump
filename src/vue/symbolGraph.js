"use strict";

const { parseVueBlocks } = require("../core/sfcBlocks");
const { parseTemplateExpressions } = require("./templateExpressions");
const {
  findTemplateLocalDeclarationAt,
  findTemplateLocalDefinition
} = require("./templateScope");
const { findVueSymbolDefinition } = require("./scriptDefinitions");
const {
  collectScriptIdentifierReferences,
  findScriptIdentifierAt,
  findScriptNavigationAt
} = require("./scriptReferences");

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
  if (!graph || !graph.blocks) {
    return null;
  }

  if (
    graph.blocks.template &&
    isInside(offset, graph.blocks.template)
  ) {
    return findTemplateDefinitionAt(graph, offset);
  }

  return findScriptNavigationAt(graph, offset);
}

function findTemplateDefinitionAt(graph, offset) {
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

function collectVueReferenceLocationsAt(graph, offset) {
  const symbol = findVueSymbolAt(graph, offset);

  if (!symbol) {
    return [];
  }

  if (symbol.kind === "template-local") {
    return collectTemplateLocalLocations(graph, symbol);
  }

  return collectScriptSymbolLocations(graph, symbol.name);
}

function findVueSymbolAt(graph, offset) {
  if (!graph || !graph.blocks) {
    return null;
  }

  if (graph.blocks.template && isInside(offset, graph.blocks.template)) {
    const localDeclaration = findTemplateLocalDeclarationAt(
      graph.template.locals,
      offset
    );

    if (localDeclaration) {
      return {
        name: localDeclaration.name,
        kind: "template-local",
        local: localDeclaration
      };
    }

    const reference = findTemplateReferenceAt(graph, offset);

    if (!reference) {
      return null;
    }

    const local = findTemplateLocalDefinition(graph.template.locals, reference);

    return {
      name: reference.name,
      kind: local ? "template-local" : "script-symbol",
      local,
      reference
    };
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

  return {
    name: identifier.name,
    kind: "script-symbol",
    reference: identifier,
    definitionOffset
  };
}

function collectTemplateLocalLocations(graph, symbol) {
  const local = symbol.local || findTemplateLocalDefinition(
    graph.template.locals,
    symbol.reference
  );

  if (!local) {
    return [];
  }

  const locations = [{
    name: local.name,
    kind: "template-local-definition",
    start: local.start,
    end: local.end
  }];

  for (const reference of graph.template.references) {
    const matched = reference.name === local.name &&
      reference.start >= local.scopeStart &&
      reference.end <= local.scopeEnd;

    if (matched) {
      locations.push({
        name: reference.name,
        kind: "template-local-reference",
        start: reference.start,
        end: reference.end
      });
    }
  }

  return uniqueLocations(locations);
}

function collectScriptSymbolLocations(graph, name) {
  const locations = [];
  const definitionOffset = findVueSymbolDefinition(graph.text, name);

  if (typeof definitionOffset === "number") {
    locations.push({
      name,
      kind: "script-definition",
      start: definitionOffset,
      end: definitionOffset + name.length
    });
  }

  for (const reference of graph.template.references) {
    if (
      reference.name === name &&
      !findTemplateLocalDefinition(graph.template.locals, reference)
    ) {
      locations.push({
        name,
        kind: "template-reference",
        start: reference.start,
        end: reference.end
      });
    }
  }

  for (const reference of collectScriptIdentifierReferences(graph, name)) {
    locations.push({
      name,
      kind: "script-reference",
      start: reference.start,
      end: reference.end
    });
  }

  return uniqueLocations(locations);
}

function uniqueLocations(locations) {
  const seen = new Set();
  const unique = [];

  for (const location of locations) {
    const key = `${location.start}:${location.end}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(location);
  }

  return unique.sort((a, b) => a.start - b.start || a.end - b.end);
}

function isInside(offset, block) {
  return offset >= block.contentStart && offset <= block.contentEnd;
}

module.exports = {
  buildVueSymbolGraph,
  collectVueReferenceLocationsAt,
  findTemplateReferenceAt,
  findVueSymbolAt,
  findVueDefinitionAt
};
