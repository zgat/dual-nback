# 贡献指南

感谢你改进双重记忆。

## 开发流程

1. 从最新的 `main` 创建分支：`feature/<name>`、`fix/<name>` 或 `docs/<name>`。
2. 保持每个提交只处理一个清晰的问题，并使用简短的祈使式提交说明。
3. 提交 Pull Request 前运行完整检查。
4. 通过 Pull Request 合并到 `main`，避免直接在 `main` 上开发。

## 必须通过的检查

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run mobile:build
git diff --check
```

## 发布约定

- 应用版本使用语义化版本号。
- Android 版本通过 `npm run version:bump:apk` 递增，避免手动修改多个版本文件。
- 发布提交合并到 `main` 后创建 `vX.Y.Z` 标签。
- APK 作为同名 GitHub Release 的附件发布，并在发布说明中写明版本和校验值。
