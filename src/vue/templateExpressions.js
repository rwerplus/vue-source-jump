"use strict";

const {
  findMatchingBracket,
  findTagEnd,
  isIgnoredTagStart,
  readTagName
} = require("../core/textUtils");

const IGNORED_IDENTIFIERS = new Set([
  "Array",
  "Boolean",
  "Date",
  "Error",
  "JSON",
  "Math",
  "Number",
  "Object",
  "Promise",
  "RegExp",
  "Set",
  "String",
  "Symbol",
  "Map",
  "NaN",
  "Infinity",
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "from",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "let",
  "new",
  "null",
  "of",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "undefined",
  "var",
  "void",
  "while",
  "with",
  "yield",
  "$event"
]);

function parseTemplateExpressions(text, templateBlock) {
  if (!templateBlock) {
    return {
      expressions: [],
      references: [],
      locals: []
    };
  }

  const state = {
    text,
    templateBlock,
    expressions: [],
    references: [],
    locals: []
  };

  scanTags(state);
  scanMustaches(state);
  sortByStart(state.expressions);
  sortByStart(state.references);
  sortByStart(state.locals);

  return {
    expressions: state.expressions,
    references: state.references,
    locals: state.locals
  };
}

function scanTags(state) {
  const { text, templateBlock } = state;
  let index = templateBlock.contentStart;

  while (index < templateBlock.contentEnd) {
    const lt = text.indexOf("<", index);

    if (lt === -1 || lt >= templateBlock.contentEnd) {
      break;
    }

    if (isIgnoredTagStart(text, lt) || text[lt + 1] === "/") {
      index = lt + 1;
      continue;
    }

    const tagEnd = findTagEnd(text, lt);

    if (tagEnd === -1 || tagEnd > templateBlock.contentEnd) {
      break;
    }

    let tagNameStart = lt + 1;

    while (/\s/.test(text[tagNameStart] || "")) {
      tagNameStart += 1;
    }

    const tagName = readTagName(text, tagNameStart);

    if (!tagName) {
      index = tagEnd + 1;
      continue;
    }

    const tagInfo = {
      name: tagName,
      start: lt,
      end: tagEnd + 1,
      openEnd: tagEnd,
      selfClosing: isSelfClosingTag(text, tagEnd),
      scopeEnd: findElementScopeEnd(text, templateBlock, lt, tagName, tagEnd)
    };
    const attrStart = tagNameStart + tagName.length;
    const attrs = parseAttributes(text, attrStart, tagEnd);

    for (const attr of attrs) {
      processAttribute(state, tagInfo, attr);
    }

    index = tagEnd + 1;
  }
}

function scanMustaches(state) {
  const { text, templateBlock } = state;
  let index = templateBlock.contentStart;

  while (index < templateBlock.contentEnd) {
    const start = text.indexOf("{{", index);

    if (start === -1 || start >= templateBlock.contentEnd) {
      break;
    }

    const end = findMustacheEnd(text, start + 2, templateBlock.contentEnd);

    if (end === -1) {
      break;
    }

    addExpression(state, {
      kind: "mustache",
      expression: text.slice(start + 2, end).trim(),
      expressionStart: start + 2 + countLeadingWhitespace(text.slice(start + 2, end)),
      start,
      end: end + 2
    });

    index = end + 2;
  }
}

function processAttribute(state, tagInfo, attr) {
  const normalized = normalizeDirectiveName(attr.name);

  if (!attr.value && normalized.kind !== "slot") {
    return;
  }

  if (normalized.kind === "for") {
    processVFor(state, tagInfo, attr);
    return;
  }

  if (normalized.kind === "slot") {
    processSlotScope(state, tagInfo, attr);
    return;
  }

  if (!isExpressionDirective(normalized)) {
    return;
  }

  addExpression(state, {
    kind: "directive",
    directive: normalized.rawName,
    expression: attr.value,
    expressionStart: attr.valueStart,
    start: attr.start,
    end: attr.end
  });
}

function processVFor(state, tagInfo, attr) {
  const parsed = parseVForExpression(attr.value, attr.valueStart);

  if (!parsed) {
    return;
  }

  for (const local of parsed.locals) {
    state.locals.push({
      name: local.name,
      kind: "v-for",
      start: local.start,
      end: local.end,
      scopeStart: tagInfo.start,
      scopeEnd: tagInfo.scopeEnd,
      source: attr.name
    });
  }

  addExpression(state, {
    kind: "v-for-source",
    directive: attr.name,
    expression: parsed.sourceExpression,
    expressionStart: parsed.sourceStart,
    start: attr.start,
    end: attr.end
  });
}

function processSlotScope(state, tagInfo, attr) {
  if (!attr.value) {
    return;
  }

  for (const local of parsePatternIdentifiers(attr.value, attr.valueStart)) {
    state.locals.push({
      name: local.name,
      kind: "slot",
      start: local.start,
      end: local.end,
      scopeStart: tagInfo.start,
      scopeEnd: tagInfo.scopeEnd,
      source: attr.name
    });
  }
}

function addExpression(state, expression) {
  if (!expression.expression) {
    return;
  }

  const entry = {
    kind: expression.kind,
    directive: expression.directive || null,
    expression: expression.expression,
    expressionStart: expression.expressionStart,
    start: expression.start,
    end: expression.end
  };

  state.expressions.push(entry);

  for (const reference of extractExpressionReferences(
    expression.expression,
    expression.expressionStart
  )) {
    state.references.push(Object.assign({}, reference, {
      kind: expression.kind,
      directive: expression.directive || null
    }));
  }
}

function extractExpressionReferences(expression, baseOffset) {
  const references = [];
  let index = 0;

  while (index < expression.length) {
    const char = expression[index];

    if (char === '"' || char === "'" || char === "`") {
      index = skipQuoted(expression, index) + 1;
      continue;
    }

    if (char === "/" && expression[index + 1] === "/") {
      index = skipLineComment(expression, index);
      continue;
    }

    if (char === "/" && expression[index + 1] === "*") {
      index = skipBlockComment(expression, index);
      continue;
    }

    if (!isIdentifierStart(char)) {
      index += 1;
      continue;
    }

    const start = index;
    index += 1;

    while (isIdentifierPart(expression[index] || "")) {
      index += 1;
    }

    const name = expression.slice(start, index);

    if (shouldKeepReference(expression, start, index, name)) {
      references.push({
        name,
        start: baseOffset + start,
        end: baseOffset + index
      });
    }
  }

  return references;
}

function shouldKeepReference(expression, start, end, name) {
  if (IGNORED_IDENTIFIERS.has(name)) {
    return false;
  }

  const previous = previousNonWhitespace(expression, start - 1);
  const next = nextNonWhitespace(expression, end);

  if (previous === ".") {
    return false;
  }

  if (next === ":" && isObjectLiteralKey(expression, start)) {
    return false;
  }

  return true;
}

function isObjectLiteralKey(expression, start) {
  const previous = previousNonWhitespace(expression, start - 1);
  return previous === "{" || previous === ",";
}

function parseVForExpression(value, valueStart) {
  const match = /([\s\S]+?)\s+(?:in|of)\s+([\s\S]+)/.exec(value);

  if (!match) {
    return null;
  }

  const lhs = match[1].trim();
  const rhs = match[2].trim();
  const lhsStart = valueStart + match.index + match[0].indexOf(match[1]) + countLeadingWhitespace(match[1]);
  const sourceStart = valueStart + match.index + match[0].lastIndexOf(match[2]) + countLeadingWhitespace(match[2]);

  return {
    locals: parsePatternIdentifiers(stripWrappingParens(lhs), lhsStart + leadingParenOffset(lhs)),
    sourceExpression: rhs,
    sourceStart
  };
}

function parsePatternIdentifiers(pattern, baseOffset) {
  const identifiers = [];
  let index = 0;

  while (index < pattern.length) {
    const char = pattern[index];

    if (char === '"' || char === "'" || char === "`") {
      index = skipQuoted(pattern, index) + 1;
      continue;
    }

    if (!isIdentifierStart(char)) {
      index += 1;
      continue;
    }

    const start = index;
    index += 1;

    while (isIdentifierPart(pattern[index] || "")) {
      index += 1;
    }

    const name = pattern.slice(start, index);
    const previous = previousNonWhitespace(pattern, start - 1);

    if (
      !IGNORED_IDENTIFIERS.has(name) &&
      previous !== "." &&
      name !== "as"
    ) {
      identifiers.push({
        name,
        start: baseOffset + start,
        end: baseOffset + index
      });
    }
  }

  return identifiers;
}

function parseAttributes(text, start, tagEnd) {
  const attrs = [];
  let index = start;

  while (index < tagEnd) {
    while (index < tagEnd && /\s/.test(text[index] || "")) {
      index += 1;
    }

    if (index >= tagEnd || text[index] === "/" || text[index] === ">") {
      break;
    }

    const attrStart = index;

    while (index < tagEnd && !/[\s=>]/.test(text[index] || "")) {
      index += 1;
    }

    const name = text.slice(attrStart, index);

    while (index < tagEnd && /\s/.test(text[index] || "")) {
      index += 1;
    }

    let value = "";
    let valueStart = index;
    let attrEnd = index;

    if (text[index] === "=") {
      index += 1;

      while (index < tagEnd && /\s/.test(text[index] || "")) {
        index += 1;
      }

      const quote = text[index];

      if (quote === '"' || quote === "'") {
        valueStart = index + 1;
        const valueEnd = findAttributeQuoteEnd(text, index, tagEnd);
        value = text.slice(valueStart, valueEnd);
        index = valueEnd < tagEnd ? valueEnd + 1 : valueEnd;
        attrEnd = index;
      } else {
        valueStart = index;

        while (index < tagEnd && !/\s/.test(text[index] || "")) {
          index += 1;
        }

        value = text.slice(valueStart, index);
        attrEnd = index;
      }
    }

    attrs.push({
      name,
      value,
      start: attrStart,
      end: attrEnd,
      valueStart
    });
  }

  return attrs;
}

function normalizeDirectiveName(name) {
  const rawName = String(name || "");

  if (rawName === "v-for") {
    return { kind: "for", rawName };
  }

  if (rawName === "v-slot" || rawName.startsWith("v-slot:") || rawName.startsWith("#")) {
    return { kind: "slot", rawName };
  }

  if (
    rawName.startsWith("@") ||
    rawName.startsWith("v-on:") ||
    rawName.startsWith(":") ||
    rawName.startsWith("v-bind:") ||
    rawName === "v-if" ||
    rawName === "v-else-if" ||
    rawName === "v-show" ||
    rawName.startsWith("v-model")
  ) {
    return { kind: "expression", rawName };
  }

  return { kind: "static", rawName };
}

function isExpressionDirective(normalized) {
  return normalized.kind === "expression";
}

function findElementScopeEnd(text, templateBlock, tagStart, tagName, openTagEnd) {
  if (isSelfClosingTag(text, openTagEnd)) {
    return openTagEnd + 1;
  }

  const lowerTagName = tagName.toLowerCase();
  let depth = 1;
  let index = openTagEnd + 1;

  while (index < templateBlock.contentEnd) {
    const lt = text.indexOf("<", index);

    if (lt === -1 || lt >= templateBlock.contentEnd) {
      break;
    }

    if (text.startsWith(`</${tagName}`, lt) || text.startsWith(`</${lowerTagName}`, lt)) {
      const closeEnd = findTagEnd(text, lt);

      if (closeEnd === -1) {
        break;
      }

      depth -= 1;

      if (depth === 0) {
        return closeEnd + 1;
      }

      index = closeEnd + 1;
      continue;
    }

    if (!isIgnoredTagStart(text, lt) && text[lt + 1] !== "/") {
      let nameStart = lt + 1;

      while (/\s/.test(text[nameStart] || "")) {
        nameStart += 1;
      }

      const name = readTagName(text, nameStart);
      const tagEnd = findTagEnd(text, lt);

      if (tagEnd === -1) {
        break;
      }

      if (name.toLowerCase() === lowerTagName && !isSelfClosingTag(text, tagEnd)) {
        depth += 1;
      }

      index = tagEnd + 1;
      continue;
    }

    index = lt + 1;
  }

  return templateBlock.contentEnd;
}

function isSelfClosingTag(text, tagEnd) {
  let index = tagEnd - 1;

  while (/\s/.test(text[index] || "")) {
    index -= 1;
  }

  return text[index] === "/";
}

function findMustacheEnd(text, start, limit) {
  let quote = "";

  for (let index = start; index < limit - 1; index += 1) {
    const char = text[index];
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

    if (char === "}" && text[index + 1] === "}") {
      return index;
    }
  }

  return -1;
}

function findAttributeQuoteEnd(text, quoteStart, tagEnd) {
  const quote = text[quoteStart];

  for (let index = quoteStart + 1; index < tagEnd; index += 1) {
    if (text[index] === quote) {
      return index;
    }
  }

  return tagEnd;
}

function skipQuoted(expression, start) {
  const quote = expression[start];

  for (let index = start + 1; index < expression.length; index += 1) {
    if (expression[index] === quote && expression[index - 1] !== "\\") {
      return index;
    }
  }

  return expression.length - 1;
}

function skipLineComment(expression, start) {
  const end = expression.indexOf("\n", start + 2);
  return end === -1 ? expression.length : end;
}

function skipBlockComment(expression, start) {
  const end = expression.indexOf("*/", start + 2);
  return end === -1 ? expression.length : end + 2;
}

function isIdentifierStart(char) {
  return /[A-Za-z_$]/.test(char);
}

function isIdentifierPart(char) {
  return /[A-Za-z0-9_$]/.test(char);
}

function previousNonWhitespace(value, index) {
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    if (!/\s/.test(value[cursor] || "")) {
      return value[cursor];
    }
  }

  return "";
}

function nextNonWhitespace(value, index) {
  for (let cursor = index; cursor < value.length; cursor += 1) {
    if (!/\s/.test(value[cursor] || "")) {
      return value[cursor];
    }
  }

  return "";
}

function stripWrappingParens(value) {
  const trimmed = value.trim();

  if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
    const end = findMatchingBracket(trimmed, 0, "(", ")");

    if (end === trimmed.length - 1) {
      return trimmed.slice(1, -1);
    }
  }

  return trimmed;
}

function leadingParenOffset(value) {
  const leading = countLeadingWhitespace(value);
  return value[leading] === "(" ? leading + 1 : leading;
}

function countLeadingWhitespace(value) {
  const match = /^\s*/.exec(value);
  return match ? match[0].length : 0;
}

function sortByStart(items) {
  items.sort((a, b) => a.start - b.start || a.end - b.end);
}

module.exports = {
  extractExpressionReferences,
  parseTemplateExpressions
};
