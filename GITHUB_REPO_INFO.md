# GitHub Repository Info

## Repository

Name:

```text
vue-source-jump
```

Description:

```text
Smart Ctrl+Click source navigation for Vue imports, aliases, component tags, and template symbols in VS Code.
```

Visibility:

```text
Public
```

Topics:

```text
vscode-extension
vue
vue2
vue3
vite
alias
go-to-definition
ctrl-click
source-navigation
javascript
typescript
```

Website:

```text
https://marketplace.visualstudio.com/items?itemName=rwerplus.vue-source-jump
```

## After Creating The Repository

```bash
git remote add origin https://github.com/rwerplus/vue-source-jump.git
git branch -M master
git add .
git commit -m "Initial release"
git push -u origin master
```

## Marketplace Publisher

The current `package.json` uses:

```json
{
  "publisher": "rwerplus"
}
```

If your VS Code Marketplace publisher id is different, update `publisher`, `repository.url`, `bugs.url`, `homepage`, `qna`, and the Marketplace URL above before publishing.

## Publish Commands

```bash
npm install
npm test
npm run package
npm run publish
```
