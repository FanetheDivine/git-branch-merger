# 分支合并工具 (git-branch-merger)

交互式终端 CLI，把多个本地分支按你选定的顺序依次合并到 target，可选 push、可选删除被合并分支。所有合并发生在专用 worktree 里，不污染当前工作区。

## 使用

进入目标 git 仓库后，通过 `npx` 直接运行：

```bash
npx git-branch-merger
```

执行目标分支：

```bash
npx git-branch-merger -t main
```

## CLI 参数

| 参数 | 说明 |
|---|---|
| `-t, --target <branch>` | 指定 target 分支|
| `--filter default\|all\|custom` | 筛选模式。default模式筛选`feature/*`和`bugfix/*` |
| `--pattern <regex>` | `custom` 模式下的正则；缺失/非法时回退到 `default` |
| `--push` / `--no-push` | 合并完成后是否 push target 到远端，未传则进入交互式询问 |
| `--remote <name>` | push / 删除远程分支使用的 remote 名，默认 `origin` |
| `--delete-branches` / `--no-delete-branches` | 是否删除已合并分支(本地 + `<remote>/<x>` 跟踪 + 远程)，未传则进入交互式询问 |
