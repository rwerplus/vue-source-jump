"use strict";

const {
  escapeRegExp,
  findTagEnd,
  isIgnoredTagStart,
  readTagName
} = require("../core/textUtils");

const DEFAULT_ASSET_PATH_PREFIXES = ["/@", "@", "~", ".", ".."];

function findTemplateAssetSourceAt(text, offset, templateBlock, aliases) {
  if (
    !templateBlock ||
    offset < templateBlock.contentStart ||
    offset > templateBlock.contentEnd
  ) {
    return null;
  }

  for (const reference of collectTemplateAssetReferences(text, templateBlock, aliases)) {
    if (offset >= reference.start && offset <= reference.end) {
      return reference;
    }
  }

  return null;
}

function collectTemplateAssetReferences(text, templateBlock, aliases) {
  const results = [];

  if (!templateBlock) {
    return results;
  }

  walkTemplateTags(text, templateBlock, (tagBodyStart, tagEnd) => {
    for (const attribute of collectAttributeValues(text, tagBodyStart, tagEnd)) {
      collectAssetPathTokens(
        attribute.value,
        attribute.valueStart,
        aliases,
        results
      );
    }
  });

  return results;
}

function walkTemplateTags(text, templateBlock, visitTagBody) {
  let index = templateBlock.contentStart;

  while (index <= templateBlock.contentEnd) {
    const tagStart = text.indexOf("<", index);

    if (tagStart === -1 || tagStart > templateBlock.contentEnd) {
      break;
    }

    if (isIgnoredTagStart(text, tagStart)) {
      index = tagStart + 1;
      continue;
    }

    const tagEnd = findTagEnd(text, tagStart);

    if (tagEnd === -1 || tagEnd > templateBlock.contentEnd) {
      break;
    }

    visitTagBody(tagStart + 1, tagEnd);
    index = tagEnd + 1;
  }
}

function collectAttributeValues(text, start, end) {
  const attributes = [];
  let index = start;
  const tagName = readTagName(text, index);

  if (!tagName) {
    return attributes;
  }

  index += tagName.length;

  while (index < end) {
    index = skipWhitespace(text, index, end);

    if (index >= end || text[index] === "/") {
      break;
    }

    const nameStart = index;

    while (
      index < end &&
      !/\s/.test(text[index]) &&
      text[index] !== "=" &&
      text[index] !== "/" &&
      text[index] !== ">"
    ) {
      index += 1;
    }

    const name = text.slice(nameStart, index);

    if (!name) {
      index += 1;
      continue;
    }

    index = skipWhitespace(text, index, end);

    if (text[index] !== "=") {
      continue;
    }

    index += 1;
    index = skipWhitespace(text, index, end);

    if (index >= end) {
      break;
    }

    const quote = text[index];
    let valueStart;
    let valueEnd;

    if (quote === "\"" || quote === "'") {
      valueStart = index + 1;
      valueEnd = findClosingQuote(text, valueStart, end, quote);

      if (valueEnd === -1) {
        valueEnd = end;
      }

      index = valueEnd + 1;
    } else {
      valueStart = index;

      while (index < end && !/\s/.test(text[index]) && text[index] !== ">") {
        index += 1;
      }

      valueEnd = index;
    }

    attributes.push({
      name,
      value: text.slice(valueStart, valueEnd),
      valueStart,
      valueEnd
    });
  }

  return attributes;
}

function collectAssetPathTokens(value, valueStart, aliases, results) {
  const assetPathRe = buildAssetPathRegExp(aliases);
  let match;

  assetPathRe.lastIndex = 0;

  while ((match = assetPathRe.exec(value))) {
    const source = trimTrailingPathPunctuation(match[0]);
    const start = valueStart + match.index;
    const end = start + source.length;

    results.push({
      source,
      start,
      end
    });
  }
}

function buildAssetPathRegExp(aliases) {
  const prefixes = collectAssetPathPrefixes(aliases);
  const prefixPattern = prefixes.map(escapeRegExp).join("|");

  return new RegExp(
    "(?:" + prefixPattern + ")[\\\\/][^\"'`\\s<>{}\\]),]+",
    "g"
  );
}

function collectAssetPathPrefixes(aliases) {
  const aliasPrefixes = aliases && typeof aliases === "object"
    ? Object.keys(aliases)
    : [];

  return uniqueStrings([...aliasPrefixes, ...DEFAULT_ASSET_PATH_PREFIXES])
    .map(normalizePathPrefix)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
}

function normalizePathPrefix(value) {
  const normalized = String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/+$/g, "");

  return normalized === "/" ? "" : normalized;
}

function uniqueStrings(values) {
  return Array.from(new Set(values));
}

function trimTrailingPathPunctuation(value) {
  return String(value || "").replace(/[.;:]+$/g, "");
}

function findClosingQuote(text, start, end, quote) {
  for (let index = start; index < end; index += 1) {
    if (text[index] === quote) {
      return index;
    }
  }

  return -1;
}

function skipWhitespace(text, index, end) {
  while (index < end && /\s/.test(text[index])) {
    index += 1;
  }

  return index;
}

module.exports = {
  collectTemplateAssetReferences,
  findTemplateAssetSourceAt
};
