"use strict";

const fs = require("fs");
const path = require("path");
const vscode = require("vscode");
const {
  buildVueSymbolGraph,
  collectVueReferenceLocationsAt,
  createWorkspaceExcludeGlob,
  findComponentRefMemberUsageAt,
  findImportBindingAt,
  findImportSourceAt,
  findFileLineReferenceAt,
  findImportedSymbolUsageAt,
  findTargetSymbolDefinition,
  findTemplateAssetSourceAt,
  findVueDefinitionAt,
  findVueSymbolDefinition,
  getTagAtOffset,
  isVueFile,
  loadProjectResolverConfig,
  parseVueBlocks,
  resolveComponentFromImports,
  resolveFileReferencePath,
  findProjectRoot,
  tagLooksLikeComponent,
  toKebabCase,
  toPascalCase
} = require("./resolver");

function activate(context) {
  const selector = [
    { language: "vue", scheme: "file" },
    { language: "javascript", scheme: "file" },
    { language: "typescript", scheme: "file" },
    { language: "javascriptreact", scheme: "file" },
    { language: "typescriptreact", scheme: "file" }
  ];

  const provider = new VueSourceJumpDefinitionProvider();

  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(selector, provider),
    vscode.commands.registerCommand("vueSourceJump.showDebugInfo", showDebugInfo),
    vscode.commands.registerCommand("vueSourceJump.nextReference", () => navigateReference("next")),
    vscode.commands.registerCommand("vueSourceJump.previousReference", () => navigateReference("previous"))
  );
}

function deactivate() {}

class VueSourceJumpDefinitionProvider {
  async provideDefinition(document, position, token) {
    const config = readConfig();
    const text = document.getText();
    const offset = document.offsetAt(position);
    const workspaceRoot = getWorkspaceRoot(document);
    const projectRoot = findProjectRoot(document.uri.fsPath, workspaceRoot);
    const resolverConfig = loadProjectResolverConfig(
      projectRoot,
      config,
      workspaceRoot
    );

    if (config.enableImportSources) {
      const importBinding = findImportBindingAt(text, offset);

      if (importBinding) {
        const target = resolveFileReferencePath(
          importBinding.source,
          document.uri.fsPath,
          projectRoot,
          resolverConfig.aliases,
          workspaceRoot,
          resolverConfig.extensions
        );

        if (target) {
          const targetOffset = findTargetSymbolDefinition(
            target,
            importBinding.importedName
          );

          if (typeof targetOffset === "number") {
            return createLocationFromFileOffset(target, targetOffset);
          }

          return createLocation(target, 1, 1);
        }
      }

      const importSource = findImportSourceAt(text, offset);

      if (importSource) {
        const target = resolveFileReferencePath(
          importSource.source,
          document.uri.fsPath,
          projectRoot,
          resolverConfig.aliases,
          workspaceRoot,
          resolverConfig.extensions
        );

        if (target) {
          return createLocation(target, 1, 1);
        }
      }
    }

    if (config.enableFileLineLinks) {
      const fileRef = findFileLineReferenceAt(text, offset);

      if (fileRef) {
        const target = resolveFileReferencePath(
          fileRef.path,
          document.uri.fsPath,
          projectRoot,
          resolverConfig.aliases,
          workspaceRoot,
          resolverConfig.extensions
        );

        if (target) {
          return createLocation(target, fileRef.line, fileRef.column);
        }
      }
    }

    if (!isVueFile(document.uri.fsPath)) {
      return null;
    }

    const blocks = parseVueBlocks(text);
    const inTemplate = blocks.template && isInside(offset, blocks.template);
    const inScript = blocks.scripts.some((block) => isInside(offset, block));

    if (!inTemplate && !inScript) {
      return null;
    }

    const graph = buildVueSymbolGraph(text);

    if (inTemplate && config.enableComponentTags) {
      const tag = getTagAtOffset(text, offset, blocks.template);

      if (tag && tagLooksLikeComponent(tag.name)) {
        const importedTarget = resolveComponentFromImports(
          text,
          tag.name,
          document.uri.fsPath,
          projectRoot,
          resolverConfig.aliases,
          workspaceRoot,
          resolverConfig.extensions
        );

        if (importedTarget) {
          return createLocation(importedTarget, 1, 1);
        }

        const scannedTarget = await findWorkspaceComponent(
          tag.name,
          config,
          projectRoot,
          token
        );

        if (scannedTarget) {
          return createLocation(scannedTarget, 1, 1);
        }
      }
    }

    if (config.enableImportSources) {
      const templateAsset = inTemplate
        ? findTemplateAssetSourceAt(
          text,
          offset,
          blocks.template,
          resolverConfig.aliases
        )
        : null;

      if (templateAsset) {
        const target = resolveFileReferencePath(
          templateAsset.source,
          document.uri.fsPath,
          projectRoot,
          resolverConfig.aliases,
          workspaceRoot,
          resolverConfig.extensions
        );

        if (target) {
          return createLocation(target, 1, 1);
        }
      }

      const importedUsage = resolveImportedSymbolUsage(
        document.uri.fsPath,
        text,
        offset,
        blocks,
        graph,
        projectRoot,
        resolverConfig,
        workspaceRoot
      );

      if (importedUsage) {
        return importedUsage;
      }
    }

    if (!config.enableTemplateSymbols) {
      return null;
    }

    const componentRefMember = await resolveComponentRefMemberUsage(
      document,
      text,
      offset,
      blocks,
      config,
      projectRoot,
      resolverConfig,
      workspaceRoot,
      token
    );

    if (componentRefMember) {
      return componentRefMember;
    }

    const graphDefinition = findVueDefinitionAt(
      graph,
      offset
    );

    if (graphDefinition && graphDefinition.target) {
      return new vscode.Location(
        document.uri,
        document.positionAt(graphDefinition.target.start)
      );
    }

    if (inTemplate) {
      const wordRange = document.getWordRangeAtPosition(
        position,
        /[A-Za-z_$][\w$]*/
      );

      if (!wordRange) {
        return null;
      }

      const word = document.getText(wordRange);
      const symbolOffset = findVueSymbolDefinition(text, word);

      if (symbolOffset == null) {
        return null;
      }

      return new vscode.Location(document.uri, document.positionAt(symbolOffset));
    }

    return null;
  }
}

async function findWorkspaceComponent(tagName, config, projectRoot, token) {
  const names = unique([
    tagName,
    toPascalCase(tagName),
    toKebabCase(tagName)
  ]).filter(Boolean);
  const roots = Array.isArray(config.componentSearchRoots)
    ? config.componentSearchRoots
    : [];
  const searchRoots = roots.length > 0 ? roots : ["src"];
  const exclude = createWorkspaceExcludeGlob(config.excludeDirectories);
  const hits = [];

  for (const root of searchRoots) {
    for (const name of names) {
      if (token && token.isCancellationRequested) {
        return null;
      }

      const filePattern = createProjectPattern(projectRoot, `${trimSlashes(root)}/**/${name}.vue`);
      const indexPattern = createProjectPattern(projectRoot, `${trimSlashes(root)}/**/${name}/index.vue`);

      hits.push(
        ...(await vscode.workspace.findFiles(
          filePattern,
          exclude,
          config.maxWorkspaceSearchResults
        ))
      );
      hits.push(
        ...(await vscode.workspace.findFiles(
          indexPattern,
          exclude,
          config.maxWorkspaceSearchResults
        ))
      );
    }
  }

  const candidates = unique(hits.map((uri) => uri.fsPath)).filter((file) =>
    fs.existsSync(file)
  );

  candidates.sort((a, b) => scoreComponentPath(a, tagName) - scoreComponentPath(b, tagName));

  return candidates[0] || null;
}

function resolveImportedSymbolUsage(
  ownerFile,
  text,
  offset,
  blocks,
  graph,
  projectRoot,
  resolverConfig,
  workspaceRoot
) {
  const usage = findImportedSymbolUsageAt(text, offset, blocks, graph);

  if (!usage) {
    return null;
  }

  return resolveImportBindingTarget(
    usage.binding,
    ownerFile,
    projectRoot,
    resolverConfig,
    workspaceRoot
  );
}

function resolveImportBindingTarget(
  binding,
  ownerFile,
  projectRoot,
  resolverConfig,
  workspaceRoot
) {
  const target = resolveFileReferencePath(
    binding.source,
    ownerFile,
    projectRoot,
    resolverConfig.aliases,
    workspaceRoot,
    resolverConfig.extensions
  );

  if (!target) {
    return null;
  }

  const targetOffset = findImportedTargetOffset(
    target,
    binding.importedName,
    binding.localName
  );

  if (typeof targetOffset === "number") {
    return createLocationFromFileOffset(target, targetOffset);
  }

  return createLocation(target, 1, 1);
}

function findImportedTargetOffset(file, importedName, localName) {
  const targetOffset = findTargetSymbolDefinition(file, importedName);

  if (typeof targetOffset === "number") {
    return targetOffset;
  }

  if (!isVueFile(file) || !fs.existsSync(file)) {
    return null;
  }

  const content = fs.readFileSync(file, "utf8");
  const names = unique([
    importedName !== "default" && importedName !== "*" ? importedName : null,
    localName
  ]).filter(Boolean);

  for (const name of names) {
    const offset = findVueSymbolDefinition(content, name);

    if (typeof offset === "number") {
      return offset;
    }
  }

  return null;
}

async function resolveComponentRefMemberUsage(
  document,
  text,
  offset,
  blocks,
  config,
  projectRoot,
  resolverConfig,
  workspaceRoot,
  token
) {
  const usage = findComponentRefMemberUsageAt(text, offset, blocks);

  if (!usage || !tagLooksLikeComponent(usage.componentRef.tagName)) {
    return null;
  }

  const target = resolveComponentFromImports(
    text,
    usage.componentRef.tagName,
    document.uri.fsPath,
    projectRoot,
    resolverConfig.aliases,
    workspaceRoot,
    resolverConfig.extensions
  ) || await findWorkspaceComponent(
    usage.componentRef.tagName,
    config,
    projectRoot,
    token
  );

  if (!target) {
    return null;
  }

  const targetOffset = findVueComponentMemberDefinition(
    target,
    usage.memberAccess.memberName
  );

  if (typeof targetOffset === "number") {
    return createLocationFromFileOffset(target, targetOffset);
  }

  return createLocation(target, 1, 1);
}

function findVueComponentMemberDefinition(file, memberName) {
  if (!file || !memberName || !fs.existsSync(file)) {
    return null;
  }

  if (!isVueFile(file)) {
    return findTargetSymbolDefinition(file, memberName);
  }

  const content = fs.readFileSync(file, "utf8");
  return findVueSymbolDefinition(content, memberName);
}

function createLocation(file, line, column) {
  const safeLine = Math.max(0, Number(line || 1) - 1);
  const safeColumn = Math.max(0, Number(column || 1) - 1);

  return new vscode.Location(
    vscode.Uri.file(file),
    new vscode.Position(safeLine, safeColumn)
  );
}

function createLocationFromFileOffset(file, offset) {
  const content = fs.readFileSync(file, "utf8");

  return new vscode.Location(
    vscode.Uri.file(file),
    offsetToPosition(content, offset)
  );
}

function offsetToPosition(content, offset) {
  const safeOffset = Math.max(0, Math.min(Number(offset) || 0, content.length));
  let line = 0;
  let column = 0;

  for (let index = 0; index < safeOffset; index += 1) {
    if (content.charCodeAt(index) === 10) {
      line += 1;
      column = 0;
    } else {
      column += 1;
    }
  }

  return new vscode.Position(line, column);
}

function readConfig() {
  const config = vscode.workspace.getConfiguration("vueSourceJump");

  return {
    enableComponentTags: config.get("enableComponentTags", true),
    enableTemplateSymbols: config.get("enableTemplateSymbols", true),
    enableFileLineLinks: config.get("enableFileLineLinks", true),
    enableImportSources: config.get("enableImportSources", true),
    aliases: getExplicitConfigValue(config, "aliases"),
    componentSearchRoots: config.get("componentSearchRoots", [
      "src",
      "components",
      "pages",
      "views"
    ]),
    maxWorkspaceSearchResults: config.get("maxWorkspaceSearchResults", 100),
    excludeDirectories: config.get("excludeDirectories", [
      "node_modules",
      "dist",
      "build",
      ".git",
      ".output",
      ".vite",
      "coverage"
    ])
  };
}

function showDebugInfo() {
  const editor = vscode.window.activeTextEditor;

  if (!editor) {
    vscode.window.showInformationMessage("Vue Source Jump: no active editor.");
    return;
  }

  const document = editor.document;
  const config = readConfig();
  const workspaceRoot = getWorkspaceRoot(document);
  const projectRoot = findProjectRoot(document.uri.fsPath, workspaceRoot);
  const resolverConfig = loadProjectResolverConfig(
    projectRoot,
    config,
    workspaceRoot
  );
  const message = [
    `file: ${document.uri.fsPath}`,
    `language: ${document.languageId}`,
    `workspaceRoot: ${workspaceRoot}`,
    `projectRoot: ${projectRoot}`,
    `aliases: ${JSON.stringify(resolverConfig.aliases)}`,
    `extensions: ${JSON.stringify(resolverConfig.extensions)}`,
    `configFiles: ${JSON.stringify(resolverConfig.configFiles)}`,
    `componentSearchRoots: ${JSON.stringify(config.componentSearchRoots)}`,
    `excludeDirectories: ${JSON.stringify(config.excludeDirectories)}`
  ].join("\n");

  vscode.window.showInformationMessage("Vue Source Jump debug info copied to clipboard.");
  vscode.env.clipboard.writeText(message);
}

function navigateReference(direction) {
  const editor = vscode.window.activeTextEditor;

  if (!editor || !isVueFile(editor.document.uri.fsPath)) {
    vscode.window.showInformationMessage("Vue Source Jump: open a Vue file first.");
    return;
  }

  const document = editor.document;
  const text = document.getText();
  const offset = document.offsetAt(editor.selection.active);
  const graph = buildVueSymbolGraph(text);
  const locations = collectVueReferenceLocationsAt(graph, offset);

  if (locations.length <= 1) {
    vscode.window.showInformationMessage("Vue Source Jump: no other references found.");
    return;
  }

  const next = pickReferenceLocation(locations, offset, direction);
  const position = document.positionAt(next.start);

  editor.selection = new vscode.Selection(position, position);
  editor.revealRange(
    new vscode.Range(position, position),
    vscode.TextEditorRevealType.InCenterIfOutsideViewport
  );
}

function pickReferenceLocation(locations, offset, direction) {
  const sorted = locations
    .slice()
    .sort((a, b) => a.start - b.start || a.end - b.end);

  if (direction === "previous") {
    for (let index = sorted.length - 1; index >= 0; index -= 1) {
      if (sorted[index].start < offset) {
        return sorted[index];
      }
    }

    return sorted[sorted.length - 1];
  }

  for (const location of sorted) {
    if (location.start > offset) {
      return location;
    }
  }

  return sorted[0];
}

function getExplicitConfigValue(config, key) {
  const inspected = config.inspect(key);

  if (!inspected) {
    return undefined;
  }

  return firstDefined([
    inspected.workspaceFolderValue,
    inspected.workspaceValue,
    inspected.globalValue
  ]);
}

function firstDefined(values) {
  for (const value of values) {
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function getWorkspaceRoot(document) {
  const folder = vscode.workspace.getWorkspaceFolder(document.uri);

  if (folder) {
    return folder.uri.fsPath;
  }

  const firstFolder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];

  if (firstFolder) {
    return firstFolder.uri.fsPath;
  }

  return path.dirname(document.uri.fsPath);
}

function isInside(offset, block) {
  return offset >= block.contentStart && offset <= block.contentEnd;
}

function trimSlashes(value) {
  return String(value || "").replace(/^[/\\]+|[/\\]+$/g, "");
}

function createProjectPattern(projectRoot, pattern) {
  if (!projectRoot) {
    return pattern;
  }

  return new vscode.RelativePattern(projectRoot, pattern);
}

function scoreComponentPath(file, tagName) {
  const base = path.basename(file, ".vue");
  const folder = path.basename(path.dirname(file));
  const pascal = toPascalCase(tagName);
  const kebab = toKebabCase(tagName);

  if (base === pascal || base === kebab) {
    return 0;
  }

  if (base.toLowerCase() === pascal.toLowerCase() || base.toLowerCase() === kebab.toLowerCase()) {
    return 1;
  }

  if (base === "index" && (folder === pascal || folder === kebab)) {
    return 2;
  }

  return 10;
}

function unique(values) {
  return Array.from(new Set(values));
}

module.exports = {
  activate,
  deactivate
};
