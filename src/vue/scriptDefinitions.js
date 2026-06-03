"use strict";

const {
  findFunctionObjectAfterKey,
  findObjectAfterKey,
  findReturnedObjectAfterKey
} = require("../core/jsScan");
const { parseVueBlocks } = require("../core/sfcBlocks");
const {
  escapeRegExp,
  findMatchingBrace,
  findMatchingBracket,
  firstNumber
} = require("../core/textUtils");

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

module.exports = {
  findVueSymbolDefinition
};
