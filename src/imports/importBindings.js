"use strict";

const {
  findMatchingBracket,
  splitTopLevel
} = require("../core/textUtils");

const IMPORT_SOURCE_RE = /\bimport\s+(?:type\s+)?(?:[^'";]*?\s+from\s*)?["']([^"']+)["']|\bexport\s+(?:type\s+)?[^'";]*?\s+from\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)|\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;

function collectImports(content) {
  const imports = [];
  const importRe = /\bimport\s+([^'";]+?)\s+from\s+["']([^"']+)["']/g;
  let match;

  while ((match = importRe.exec(content))) {
    const clause = match[1].trim();
    const source = match[2].trim();

    if (clause.startsWith("{")) {
      imports.push(...parseNamedImports(clause, source));
      continue;
    }

    if (clause.startsWith("*")) {
      const namespaceMatch = /\*\s+as\s+([A-Za-z_$][\w$]*)/.exec(clause);

      if (namespaceMatch) {
        imports.push({ local: namespaceMatch[1], source });
      }

      continue;
    }

    const defaultName = /^([A-Za-z_$][\w$]*)/.exec(clause);

    if (defaultName) {
      imports.push({ local: defaultName[1], source });
    }

    const namedStart = clause.indexOf("{");

    if (namedStart !== -1) {
      imports.push(...parseNamedImports(clause.slice(namedStart), source));
    }
  }

  return imports;
}

function parseNamedImports(clause, source) {
  const content = clause.replace(/^\{|\}$/g, "");

  return splitTopLevel(content)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/^type\s+/, "").trim())
    .map((part) => {
      const aliasMatch = /^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/.exec(part);

      if (aliasMatch) {
        return { local: aliasMatch[2], source };
      }

      const localMatch = /^([A-Za-z_$][\w$]*)$/.exec(part);

      return localMatch ? { local: localMatch[1], source } : null;
    })
    .filter(Boolean);
}

function collectDynamicComponentImports(content) {
  const imports = [];
  const dynamicRe = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:defineAsyncComponent\s*\(\s*)?(?:\(\s*\)\s*=>\s*)?import\s*\(\s*["']([^"']+)["']\s*\)/g;
  let match;

  while ((match = dynamicRe.exec(content))) {
    imports.push({
      local: match[1],
      source: match[2]
    });
  }

  return imports;
}

function collectImportBindings(text) {
  const bindings = [];
  const importRe = /\bimport\s+(?:type\s+)?([\s\S]*?)\s+from\s*["']([^"']+)["']/g;
  let match;

  while ((match = importRe.exec(text))) {
    const statementStart = match.index;
    const clause = match[1];
    const source = match[2];
    const clauseStart = statementStart + match[0].indexOf(clause);

    bindings.push(...collectBindingsInImportClause(clause, clauseStart, source));
  }

  return bindings;
}

function findImportBindingByLocalName(text, localName) {
  if (!/^[A-Za-z_$][\w$]*$/.test(localName || "")) {
    return null;
  }

  return collectImportBindings(text).find((binding) =>
    binding.localName === localName
  ) || null;
}

function findImportBindingAt(text, offset) {
  const importRe = /\bimport\s+(?:type\s+)?([\s\S]*?)\s+from\s*["']([^"']+)["']/g;
  let match;

  while ((match = importRe.exec(text))) {
    const statementStart = match.index;
    const statementEnd = match.index + match[0].length;

    if (offset < statementStart || offset > statementEnd) {
      continue;
    }

    const clause = match[1];
    const source = match[2];
    const clauseStart = statementStart + match[0].indexOf(clause);
    const binding = findBindingInImportClause(clause, clauseStart, source, offset);

    if (binding) {
      return binding;
    }
  }

  return null;
}

function collectBindingsInImportClause(clause, clauseStart, source) {
  const bindings = [];
  const trimmed = clause.trimStart();
  const leading = clause.length - trimmed.length;
  const firstChar = trimmed[0];

  if (firstChar !== "{" && firstChar !== "*") {
    const defaultMatch = /^([A-Za-z_$][\w$]*)/.exec(trimmed);

    if (defaultMatch) {
      const start = clauseStart + leading;
      const end = start + defaultMatch[1].length;

      bindings.push({
        localName: defaultMatch[1],
        importedName: "default",
        source,
        start,
        end,
        localStart: start,
        localEnd: end,
        importedStart: start,
        importedEnd: end
      });
    }
  }

  const namespaceMatch = /\*\s+as\s+([A-Za-z_$][\w$]*)/.exec(clause);

  if (namespaceMatch) {
    const localStart = clauseStart + namespaceMatch.index + namespaceMatch[0].lastIndexOf(namespaceMatch[1]);
    const localEnd = localStart + namespaceMatch[1].length;

    bindings.push({
      localName: namespaceMatch[1],
      importedName: "*",
      source,
      start: localStart,
      end: localEnd,
      localStart,
      localEnd,
      importedStart: localStart,
      importedEnd: localEnd
    });
  }

  const namedStart = clause.indexOf("{");

  if (namedStart === -1) {
    return bindings;
  }

  const namedEnd = findMatchingBracket(clause, namedStart, "{", "}");

  if (namedEnd === -1) {
    return bindings;
  }

  bindings.push(...collectNamedImportBindings(
    clause.slice(namedStart + 1, namedEnd),
    clauseStart + namedStart + 1,
    source
  ));

  return bindings;
}

function findBindingInImportClause(clause, clauseStart, source, offset) {
  const binding = collectBindingsInImportClause(clause, clauseStart, source)
    .find((item) =>
      (offset >= item.localStart && offset <= item.localEnd) ||
      (offset >= item.importedStart && offset <= item.importedEnd)
    );

  if (!binding) {
    return null;
  }

  const onLocal = offset >= binding.localStart && offset <= binding.localEnd;

  return Object.assign({}, binding, {
    start: onLocal ? binding.localStart : binding.importedStart,
    end: onLocal ? binding.localEnd : binding.importedEnd
  });
}

function collectNamedImportBindings(content, contentStart, source) {
  const bindings = [];
  const specifierRe = /\b(?:type\s+)?([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?/g;
  let match;

  while ((match = specifierRe.exec(content))) {
    const importedName = match[1];
    const localName = match[2] || importedName;
    const importedStart = contentStart + match.index + match[0].indexOf(importedName);
    const importedEnd = importedStart + importedName.length;
    const localStart = match[2]
      ? contentStart + match.index + match[0].lastIndexOf(match[2])
      : importedStart;
    const localEnd = localStart + localName.length;

    bindings.push({
      localName,
      importedName,
      source,
      start: localStart,
      end: localEnd,
      localStart,
      localEnd,
      importedStart,
      importedEnd
    });
  }

  return bindings;
}

function findImportSourceAt(text, offset) {
  let match;

  IMPORT_SOURCE_RE.lastIndex = 0;

  while ((match = IMPORT_SOURCE_RE.exec(text))) {
    const source = match[1] || match[2] || match[3] || match[4];

    if (!source) {
      continue;
    }

    const literal = findSourceLiteralInMatch(match[0], source);

    if (!literal) {
      continue;
    }

    const start = match.index + literal.start + 1;
    const end = start + source.length;

    if (offset >= start && offset <= end) {
      return {
        source,
        start,
        end
      };
    }
  }

  return null;
}

function findSourceLiteralInMatch(matchText, source) {
  const doubleQuoted = `"${source}"`;
  const singleQuoted = `'${source}'`;
  const doubleIndex = matchText.lastIndexOf(doubleQuoted);
  const singleIndex = matchText.lastIndexOf(singleQuoted);

  if (doubleIndex === -1 && singleIndex === -1) {
    return null;
  }

  if (doubleIndex > singleIndex) {
    return {
      start: doubleIndex,
      end: doubleIndex + doubleQuoted.length
    };
  }

  return {
    start: singleIndex,
    end: singleIndex + singleQuoted.length
  };
}

module.exports = {
  collectDynamicComponentImports,
  collectImportBindings,
  collectImports,
  findImportBindingByLocalName,
  findImportBindingAt,
  findImportSourceAt
};
