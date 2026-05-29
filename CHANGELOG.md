# Changelog

## 0.1.2

- 修复 ctrl+c 退出码：改用 ink 的 `useApp().exit(error)` 抛错，由 `waitUntilExit()` 接住后以 130 退出，避免在 `npx ... && next-cmd` 链式命令中被误判为成功并继续执行后续命令
