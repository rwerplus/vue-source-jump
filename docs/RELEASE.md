# 发布版本标准

本文档记录 Vue Source Jump 发布后的版本管理流程。插件已经发布到 VS Code Marketplace 后，后续任何代码、文档、配置、资源改动都需要遵循版本发布标准。

## 当前基线

- 已发布基线版本：`0.1.0`
- 当前开发分支版本：`0.1.1`
- 扩展 ID：`guofeng.vue-source-jump`
- 发布目标：VS Code Marketplace

## 版本号规则

遵循 SemVer 语义化版本：

```text
major.minor.patch
```

- `patch`：修复 bug、文档小修、元信息调整、兼容性小修。
  - 示例：`0.1.0 -> 0.1.1`
- `minor`：新增功能，但不破坏已有使用方式。
  - 示例：`0.1.0 -> 0.2.0`
- `major`：有破坏性变更，可能影响已有用户使用方式。
  - 示例：`1.0.0 -> 2.0.0`

## 分支规则

发布后不直接在 `master` 上做新版本改动。每次改动先创建独立分支：

```bash
git switch -c codex/<change-name>-v<next-version>
```

示例：

```bash
git switch -c codex/release-standards-v0.1.1
git switch -c codex/import-jump-v0.2.0
git switch -c codex/fix-alias-resolver-v0.1.2
```

## 每次发布前必须更新

发布前至少检查并更新这些内容：

- `package.json`
  - `version`
  - `description`，如果功能定位发生变化
  - `keywords`，如果新增可搜索能力
- `README.md`
  - 新功能说明
  - 新配置说明
  - 使用示例
  - 限制说明
- `CHANGELOG.md`
  - 新版本号
  - 发布日期
  - Added / Changed / Fixed / Removed
- `docs/*`
  - 架构、发布流程、开发规范变化

## 发布前验证

发布前必须执行：

```bash
npm run check
npm test
npm run package
```

验证通过后再发布：

```bash
npm run publish
```

如果只是文档改动，至少也要执行：

```bash
npm run package
```

确保 README、icon、manifest、版本号可以正确进入 VSIX。

## 提交和标签规则

功能或修复提交：

```bash
git commit -m "Support xxx"
git commit -m "Fix xxx"
git commit -m "Update xxx docs"
```

版本发布提交：

```bash
git commit -m "Release v0.1.1"
```

发布 tag：

```bash
git tag v0.1.1
git push origin v0.1.1
```

## 推荐发布流程

1. 从 `master` 新建版本分支。
2. 完成功能、修复或文档改动。
3. 根据改动类型确定 `patch`、`minor` 或 `major`。
4. 更新 `package.json` 版本号。
5. 更新 `README.md`、`CHANGELOG.md` 和相关 docs。
6. 执行验证命令。
7. 提交改动。
8. 合并到 `master`。
9. 创建版本 tag。
10. 执行 `npm run publish`。
11. 推送代码和 tag。

## AI 协作要求

后续让 AI 继续开发时，默认要求：

- 先判断改动类型对应的版本级别。
- 不再只提交功能代码，需要同时考虑版本号、文档、CHANGELOG。
- 涉及用户可见能力变化时，必须更新 README。
- 涉及架构或流程变化时，必须更新 docs。
- 发布前必须说明验证命令和结果。
- 已发布版本不得复用同一个版本号再次发布。

## 注意事项

- VS Code Marketplace 不允许重复发布同一个版本号。
- 如果 `publisher` 与当前发布账号不一致，会发布失败。
- Marketplace 扩展 ID 由 `publisher.name` 组成，例如 `guofeng.vue-source-jump`。
- 使用官方 Vue 图标可能带来“看起来像官方扩展”的识别风险，发布说明中应避免暗示本插件是 Vue 官方插件。
