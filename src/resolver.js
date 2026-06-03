"use strict";

const fs = require("fs");
const path = require("path");

const VUE_BLOCK_RE = /<(template|script)\b([^>]*)>/gi;
const FILE_REF_RE = /((?:(?:[A-Za-z]:)?[\\/]|(?:\/@|@|~)[\\/]|\.{1,2}[\\/]|[A-Za-z0-9_-]+[\\/])(?:[A-Za-z0-9_@./~-]+[\\/])*[A-Za-z0-9_@.~-]+\.[A-Za-z0-9]+)(?:[:#](\d+))?(?::(\d+))?/g;
const IMPORT_SOURCE_RE = /\bimport\s+(?:type\s+)?(?:[^'";]*?\s+from\s*)?["']([^"']+)["']|\bexport\s+(?:type\s+)?[^'";]*?\s+from\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)|\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;
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

const HTML_TAGS = new Set([
  "a",
  "abbr",
  "address",
  "area",
  "article",
  "aside",
  "audio",
  "b",
  "base",
  "bdi",
  "bdo",
  "blockquote",
  "body",
  "br",
  "button",
  "canvas",
  "caption",
  "cite",
  "code",
  "col",
  "colgroup",
  "data",
  "datalist",
  "dd",
  "del",
  "details",
  "dfn",
  "dialog",
  "div",
  "dl",
  "dt",
  "em",
  "embed",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hr",
  "html",
  "i",
  "iframe",
  "img",
  "input",
  "ins",
  "kbd",
  "label",
  "legend",
  "li",
  "link",
  "main",
  "map",
  "mark",
  "menu",
  "meta",
  "meter",
  "nav",
  "noscript",
  "object",
  "ol",
  "optgroup",
  "option",
  "output",
  "p",
  "param",
  "picture",
  "pre",
  "progress",
  "q",
  "rp",
  "rt",
  "ruby",
  "s",
  "samp",
  "script",
  "section",
  "select",
  "slot",
  "small",
  "source",
  "span",
  "strong",
  "style",
  "sub",
  "summary",
  "sup",
  "svg",
  "table",
  "tbody",
  "td",
  "template",
  "textarea",
  "tfoot",
  "th",
  "thead",
  "time",
  "title",
  "tr",
  "track",
  "u",
  "ul",
  "var",
  "video",
  "wbr"
]);

const VUE_BUILT_INS = new Set([
  "component",
  "keep-alive",
  "router-link",
  "router-view",
  "slot",
  "suspense",
  "teleport",
  "transition",
  "transition-group"
]);

function parseVueBlocks(text) {
  const blocks = {
    template: null,
    scripts: []
  };
  let match;

  VUE_BLOCK_RE.lastIndex = 0;

  while ((match = VUE_BLOCK_RE.exec(text))) {
    const tag = match[1].toLowerCase();
    const attrs = match[2] || "";
    const openEnd = findTagEnd(text, match.index);

    if (openEnd === -1) {
      continue;
    }

    const closeTag = `</${tag}>`;
    const closeStart = text.toLowerCase().indexOf(closeTag, openEnd + 1);

    if (closeStart === -1) {
      continue;
    }

    const block = {
      attrs,
      setup: /\bsetup\b/i.test(attrs),
      openStart: match.index,
      openEnd,
      contentStart: openEnd + 1,
      contentEnd: closeStart
    };

    if (tag === "template" && !blocks.template) {
      blocks.template = block;
    } else if (tag === "script") {
      blocks.scripts.push(block);
    }

    VUE_BLOCK_RE.lastIndex = closeStart + closeTag.length;
  }

  return blocks;
}

function getTagAtOffset(text, offset, templateBlock) {
  const lt = text.lastIndexOf("<", offset);

  if (lt < templateBlock.contentStart) {
    return null;
  }

  const previousGt = text.lastIndexOf(">", offset);

  if (previousGt > lt) {
    return null;
  }

  if (isIgnoredTagStart(text, lt)) {
    return null;
  }

  const tagEnd = findTagEnd(text, lt);

  if (tagEnd === -1 || tagEnd > templateBlock.contentEnd || offset > tagEnd) {
    return null;
  }

  let nameStart = lt + 1;

  while (/\s/.test(text[nameStart] || "")) {
    nameStart += 1;
  }

  const name = readTagName(text, nameStart);

  if (!name) {
    return null;
  }

  const nameEnd = nameStart + name.length;

  if (offset < nameStart || offset > nameEnd) {
    return null;
  }

  return {
    name,
    start: nameStart,
    end: nameEnd
  };
}

function tagLooksLikeComponent(tagName) {
  const normalized = String(tagName || "").toLowerCase();

  if (!tagName || HTML_TAGS.has(normalized) || VUE_BUILT_INS.has(normalized)) {
    return false;
  }

  return /^[A-Z]/.test(tagName) || tagName.includes("-");
}

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

function findVueSymbolDefinition(text, symbolName) {
  if (!/^[A-Za-z_$][\w$]*$/.test(symbolName || "")) {
    return null;
  }

  const blocks = parseVueBlocks(text);

  for (const block of blocks.scripts) {
    const content = text.slice(block.contentStart, block.contentEnd);
    const relative = block.setup
      ? findScriptSetupSymbol(content, symbolName)
      : findOptionsApiSymbol(content, symbolName);

    if (relative != null) {
      return block.contentStart + relative;
    }
  }

  return null;
}

function findScriptSetupSymbol(content, symbolName) {
  return firstNumber([
    findDeclaration(content, symbolName),
    findDefinePropsObjectKey(content, symbolName),
    findDefinePropsTypeKey(content, symbolName),
    findDefinePropsDestructure(content, symbolName),
    findObjectProperty(content, "defineEmits", symbolName),
    findCallArrayStringItem(content, "defineEmits", symbolName)
  ]);
}

function findOptionsApiSymbol(content, symbolName) {
  const setupObject = findFunctionObjectAfterKey(content, "setup");
  const dataObject = findReturnedObjectAfterKey(content, "data");

  return firstNumber([
    findOptionProperty(content, "methods", symbolName),
    findOptionProperty(content, "computed", symbolName),
    findPropsOptionProperty(content, symbolName),
    dataObject && findPropertyInObject(dataObject.content, symbolName, dataObject.start),
    setupObject && findDeclaration(setupObject.content, symbolName, setupObject.start),
    findDeclaration(content, symbolName)
  ]);
}

function findDeclaration(content, symbolName, baseOffset) {
  const base = baseOffset || 0;
  const escaped = escapeRegExp(symbolName);
  const patterns = [
    new RegExp(`\\bfunction\\s+(${escaped})\\b`),
    new RegExp(`\\bclass\\s+(${escaped})\\b`),
    new RegExp(`\\b(?:const|let|var)\\s+(${escaped})\\b`),
    new RegExp(`\\b(?:const|let|var)\\s+\\{[^}]*\\b(${escaped})\\b[^}]*\\}`)
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(content);

    if (match) {
      return base + match.index + match[0].indexOf(symbolName);
    }
  }

  return null;
}

function findOptionProperty(content, optionName, symbolName) {
  const object = findObjectAfterKey(content, optionName);

  if (!object) {
    return null;
  }

  return findPropertyInObject(object.content, symbolName, object.start);
}

function findPropsOptionProperty(content, symbolName) {
  const objectHit = findOptionProperty(content, "props", symbolName);

  if (objectHit != null) {
    return objectHit;
  }

  return findArrayAfterKeyStringItem(content, "props", symbolName);
}

function findPropertyInObject(content, propertyName, baseOffset) {
  const base = baseOffset || 0;
  const escaped = escapeRegExp(propertyName);
  const patterns = [
    new RegExp(`(["'])(${escaped})\\1\\s*:`),
    new RegExp(`(^|[,\\s])(${escaped})\\s*(?=[:(,}])`)
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(content);

    if (match) {
      return base + match.index + match[0].lastIndexOf(propertyName);
    }
  }

  return null;
}

function findDefinePropsObjectKey(content, symbolName) {
  return findObjectProperty(content, "defineProps", symbolName);
}

function findDefinePropsTypeKey(content, symbolName) {
  const callIndex = content.indexOf("defineProps<");

  if (callIndex === -1) {
    return null;
  }

  const typeStart = content.indexOf("{", callIndex);

  if (typeStart === -1) {
    return null;
  }

  const typeEnd = findMatchingBrace(content, typeStart);

  if (typeEnd === -1) {
    return null;
  }

  return findPropertyInObject(
    content.slice(typeStart + 1, typeEnd),
    symbolName,
    typeStart + 1
  );
}

function findObjectProperty(content, calleeName, symbolName) {
  const call = content.indexOf(`${calleeName}(`);

  if (call === -1) {
    return null;
  }

  const objectStart = content.indexOf("{", call);

  if (objectStart === -1) {
    return null;
  }

  const objectEnd = findMatchingBrace(content, objectStart);

  if (objectEnd === -1) {
    return null;
  }

  return findPropertyInObject(
    content.slice(objectStart + 1, objectEnd),
    symbolName,
    objectStart + 1
  );
}

function findCallArrayStringItem(content, calleeName, symbolName) {
  const call = content.indexOf(`${calleeName}(`);

  if (call === -1) {
    return null;
  }

  const arrayStart = content.indexOf("[", call);

  if (arrayStart === -1) {
    return null;
  }

  const arrayEnd = findMatchingBracket(content, arrayStart, "[", "]");

  if (arrayEnd === -1) {
    return null;
  }

  return findStringItemInRange(content, arrayStart + 1, arrayEnd, symbolName);
}

function findArrayAfterKeyStringItem(content, key, symbolName) {
  const keyRe = new RegExp(`\\b${escapeRegExp(key)}\\s*:`, "g");
  const match = keyRe.exec(content);

  if (!match) {
    return null;
  }

  const arrayStart = content.indexOf("[", match.index + match[0].length);

  if (arrayStart === -1) {
    return null;
  }

  const arrayEnd = findMatchingBracket(content, arrayStart, "[", "]");

  if (arrayEnd === -1) {
    return null;
  }

  return findStringItemInRange(content, arrayStart + 1, arrayEnd, symbolName);
}

function findStringItemInRange(content, start, end, symbolName) {
  const escaped = escapeRegExp(symbolName);
  const pattern = new RegExp(`(["'])(${escaped})\\1`, "g");
  pattern.lastIndex = start;

  let match;

  while ((match = pattern.exec(content))) {
    if (match.index > end) {
      break;
    }

    return match.index + match[0].indexOf(symbolName);
  }

  return null;
}

function findDefinePropsDestructure(content, symbolName) {
  const pattern = new RegExp(`\\b(?:const|let|var)\\s+\\{[^}]*\\b(${escapeRegExp(symbolName)})\\b[^}]*\\}\\s*=\\s*defineProps\\b`);
  const match = pattern.exec(content);

  if (!match) {
    return null;
  }

  return match.index + match[0].indexOf(symbolName);
}

function findFunctionObjectAfterKey(content, key) {
  const keyRe = new RegExp(`\\b${escapeRegExp(key)}\\s*\\(`);
  const keyMatch = keyRe.exec(content);

  if (!keyMatch) {
    return null;
  }

  const bodyStart = content.indexOf("{", keyMatch.index);

  if (bodyStart === -1) {
    return null;
  }

  const bodyEnd = findMatchingBrace(content, bodyStart);

  if (bodyEnd === -1) {
    return null;
  }

  return {
    content: content.slice(bodyStart + 1, bodyEnd),
    start: bodyStart + 1
  };
}

function findReturnedObjectAfterKey(content, key) {
  const functionObject = findFunctionObjectAfterKey(content, key);

  if (!functionObject) {
    return null;
  }

  const returnIndex = functionObject.content.indexOf("return");

  if (returnIndex === -1) {
    return null;
  }

  const objectStart = functionObject.content.indexOf("{", returnIndex);

  if (objectStart === -1) {
    return null;
  }

  const objectEnd = findMatchingBrace(functionObject.content, objectStart);

  if (objectEnd === -1) {
    return null;
  }

  return {
    content: functionObject.content.slice(objectStart + 1, objectEnd),
    start: functionObject.start + objectStart + 1
  };
}

function findObjectAfterKey(content, key) {
  const keyRe = new RegExp(`\\b${escapeRegExp(key)}\\s*:`, "g");
  const match = keyRe.exec(content);

  if (!match) {
    return null;
  }

  const objectStart = content.indexOf("{", match.index + match[0].length);

  if (objectStart === -1) {
    return null;
  }

  const objectEnd = findMatchingBrace(content, objectStart);

  if (objectEnd === -1) {
    return null;
  }

  return {
    content: content.slice(objectStart + 1, objectEnd),
    start: objectStart + 1
  };
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

function findBindingInImportClause(clause, clauseStart, source, offset) {
  const trimmed = clause.trimStart();
  const leading = clause.length - trimmed.length;
  const firstChar = trimmed[0];

  if (firstChar !== "{" && firstChar !== "*") {
    const defaultMatch = /^([A-Za-z_$][\w$]*)/.exec(trimmed);

    if (defaultMatch) {
      const start = clauseStart + leading;
      const end = start + defaultMatch[1].length;

      if (offset >= start && offset <= end) {
        return {
          localName: defaultMatch[1],
          importedName: "default",
          source,
          start,
          end
        };
      }
    }
  }

  const namespaceMatch = /\*\s+as\s+([A-Za-z_$][\w$]*)/.exec(clause);

  if (namespaceMatch) {
    const localStart = clauseStart + namespaceMatch.index + namespaceMatch[0].lastIndexOf(namespaceMatch[1]);
    const localEnd = localStart + namespaceMatch[1].length;

    if (offset >= localStart && offset <= localEnd) {
      return {
        localName: namespaceMatch[1],
        importedName: "*",
        source,
        start: localStart,
        end: localEnd
      };
    }
  }

  const namedStart = clause.indexOf("{");

  if (namedStart === -1) {
    return null;
  }

  const namedEnd = findMatchingBracket(clause, namedStart, "{", "}");

  if (namedEnd === -1) {
    return null;
  }

  return findNamedImportBinding(
    clause.slice(namedStart + 1, namedEnd),
    clauseStart + namedStart + 1,
    source,
    offset
  );
}

function findNamedImportBinding(content, contentStart, source, offset) {
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

    if (
      (offset >= importedStart && offset <= importedEnd) ||
      (offset >= localStart && offset <= localEnd)
    ) {
      return {
        localName,
        importedName,
        source,
        start: offset >= localStart && offset <= localEnd ? localStart : importedStart,
        end: offset >= localStart && offset <= localEnd ? localEnd : importedEnd
      };
    }
  }

  return null;
}

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

function findFileLineReferenceAt(text, offset) {
  const lineStart = text.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
  const nextBreak = text.indexOf("\n", offset);
  const lineEnd = nextBreak === -1 ? text.length : nextBreak;
  const line = text.slice(lineStart, lineEnd);
  let match;

  FILE_REF_RE.lastIndex = 0;

  while ((match = FILE_REF_RE.exec(line))) {
    const start = lineStart + match.index;
    const end = start + match[0].length;

    if (offset >= start && offset <= end) {
      return {
        path: match[1],
        line: match[2] ? Number(match[2]) : 1,
        column: match[3] ? Number(match[3]) : 1,
        start,
        end
      };
    }
  }

  return null;
}

function resolveFileReferencePath(rawPath, currentFile, projectRoot, aliases, workspaceRoot, extensions) {
  const cleaned = String(rawPath || "").split(/[?#]/)[0].replace(/\\/g, path.sep);

  if (!cleaned) {
    return null;
  }

  if (isBarePackagePath(cleaned)) {
    return null;
  }

  const roots = [];
  const aliased = resolveAliasPaths(cleaned, projectRoot, aliases, workspaceRoot);

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

function resolveAliasPaths(value, projectRoot, aliases, workspaceRoot) {
  if (!projectRoot || !aliases || typeof aliases !== "object") {
    return [];
  }

  const matches = [];
  const bases = unique([projectRoot, workspaceRoot].filter(Boolean));

  for (const alias of Object.keys(aliases)) {
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

function findStructuredValueAfterKey(content, key) {
  const expression = findPropertyExpression(content, key);

  if (!expression) {
    return null;
  }

  const trimmed = expression.trimStart();
  const offset = expression.length - trimmed.length;
  const first = trimmed[0];

  if (first === "{") {
    const end = findMatchingBrace(trimmed, 0);

    if (end === -1) {
      return null;
    }

    return {
      kind: "object",
      content: trimmed.slice(1, end),
      start: offset,
      end: offset + end
    };
  }

  if (first === "[") {
    const end = findMatchingBracket(trimmed, 0, "[", "]");

    if (end === -1) {
      return null;
    }

    return {
      kind: "array",
      content: trimmed.slice(1, end),
      start: offset,
      end: offset + end
    };
  }

  return null;
}

function findPropertyExpression(content, key) {
  const pattern = new RegExp(
    `(?:^|[,\\s{])(?:["']${escapeRegExp(key)}["']|${escapeRegExp(key)})\\s*:`,
    "g"
  );
  const match = pattern.exec(content);

  if (!match) {
    return null;
  }

  return content.slice(match.index + match[0].length);
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

function collectStringLiterals(content) {
  const values = [];
  const pattern = /["']([^"']+)["']/g;
  let match;

  while ((match = pattern.exec(content))) {
    values.push(match[1]);
  }

  return values;
}

function stripPathWildcard(value) {
  return String(value || "").replace(/\/?\*$/, "");
}

function stripJsonCommentsAndTrailingCommas(value) {
  let output = "";
  let quote = "";

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const next = value[index + 1];
    const previous = value[index - 1];

    if (quote) {
      output += char;

      if (char === quote && previous !== "\\") {
        quote = "";
      }

      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      output += char;
      continue;
    }

    if (char === "/" && next === "/") {
      while (index < value.length && value[index] !== "\n") {
        index += 1;
      }

      output += "\n";
      continue;
    }

    if (char === "/" && next === "*") {
      index += 2;

      while (index < value.length && !(value[index] === "*" && value[index + 1] === "/")) {
        index += 1;
      }

      index += 1;
      continue;
    }

    output += char;
  }

  return output.replace(/,\s*([}\]])/g, "$1");
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

function matchesComponentName(localName, tagName) {
  if (!localName || !tagName) {
    return false;
  }

  const expected = new Set([
    String(localName),
    toPascalCase(localName),
    toKebabCase(localName)
  ]);

  return (
    expected.has(String(tagName)) ||
    expected.has(toPascalCase(tagName)) ||
    expected.has(toKebabCase(tagName))
  );
}

function toPascalCase(value) {
  return String(value || "")
    .split(/[-_:]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function toKebabCase(value) {
  return String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_:\s]+/g, "-")
    .toLowerCase();
}

function isVueFile(file) {
  return /\.vue$/i.test(String(file || "").split("?")[0]);
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

function unique(values) {
  return Array.from(new Set(values));
}

function findTagEnd(source, start) {
  let quote = "";

  for (let index = start + 1; index < source.length; index += 1) {
    const char = source[index];

    if (quote) {
      if (char === quote) {
        quote = "";
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === ">") {
      return index;
    }
  }

  return -1;
}

function findMatchingBrace(source, start) {
  return findMatchingBracket(source, start, "{", "}");
}

function findMatchingBracket(source, start, openChar, closeChar) {
  let depth = 0;
  let quote = "";

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    const previous = source[index - 1];

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

    if (char === openChar) {
      depth += 1;
      continue;
    }

    if (char === closeChar) {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function splitTopLevel(content) {
  const parts = [];
  let start = 0;
  let depth = 0;
  let quote = "";

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const previous = content[index - 1];

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

    if (char === "{" || char === "[" || char === "(") {
      depth += 1;
      continue;
    }

    if (char === "}" || char === "]" || char === ")") {
      depth -= 1;
      continue;
    }

    if (char === "," && depth === 0) {
      parts.push(content.slice(start, index));
      start = index + 1;
    }
  }

  parts.push(content.slice(start));
  return parts;
}

function readTagName(source, start) {
  const match = /^[A-Za-z][A-Za-z0-9:_-]*/.exec(source.slice(start));
  return match ? match[0] : "";
}

function isIgnoredTagStart(source, ltIndex) {
  const next = source[ltIndex + 1];

  return next === "/" || next === "!" || next === "?";
}

function firstNumber(values) {
  for (const value of values) {
    if (typeof value === "number") {
      return value;
    }
  }

  return null;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  collectComponentCandidates,
  findFileLineReferenceAt,
  findImportBindingAt,
  findImportSourceAt,
  findProjectRoot,
  findTargetSymbolDefinition,
  findVueSymbolDefinition,
  getTagAtOffset,
  isVueFile,
  loadProjectResolverConfig,
  matchesComponentName,
  parseVueBlocks,
  resolveComponentFromImports,
  resolveFileReferencePath,
  tagLooksLikeComponent,
  toKebabCase,
  toPascalCase
};
