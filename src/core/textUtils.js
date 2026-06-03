"use strict";

function unique(values) {
  return Array.from(new Set(values));
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

function collectStringLiterals(content) {
  const values = [];
  const pattern = /["']([^"']+)["']/g;
  let match;

  while ((match = pattern.exec(content))) {
    values.push(match[1]);
  }

  return values;
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

module.exports = {
  collectStringLiterals,
  escapeRegExp,
  findMatchingBrace,
  findMatchingBracket,
  findTagEnd,
  firstNumber,
  isIgnoredTagStart,
  readTagName,
  splitTopLevel,
  stripJsonCommentsAndTrailingCommas,
  unique
};
