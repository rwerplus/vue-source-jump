"use strict";

const {
  escapeRegExp,
  findMatchingBrace,
  findMatchingBracket
} = require("./textUtils");

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

module.exports = {
  findFunctionObjectAfterKey,
  findObjectAfterKey,
  findPropertyExpression,
  findReturnedObjectAfterKey,
  findStructuredValueAfterKey
};
