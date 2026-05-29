# 分支合并工具 (git-branch-merger)

交互式 CLI：把多个本地分支按你选定的顺序依次合并到 target，可选 push、可选删除被合并分支。基于 `ink` + `simple-git`，所有合并发生在专用 worktree 里，不污染当前工作区。

## 快速开始

```bash
pnpm i
pnpm build

# 软链成全局命令(推荐)
pnpm link --global

# 进入任意 git 仓库后
git-branch-merger
```

也可以不软链直接用：

```bash
node /path/to/git-branch-merger/dist/index.js
```

> CLI 操作的是**当前工作目录**的 git 仓库，请先 `cd` 到目标仓库再运行。

## CLI 参数

参数齐备直接进入分支列表；只齐 `target` 跳到筛选步；都没传走完整交互。每个步骤结束都会把日志（含启动参数）固定打印到 stdout，不会被下一步骤的 UI 覆盖。

| 参数 | 说明 |
|---|---|
| `-t, --target <branch>` | 指定 target 分支。**直接信任不校验**，传错由后续 git 报错兜底 |
| `--filter default\|all\|custom` | 筛选模式，默认 `default`(`^(feature\|bugfix)/`) |
| `--pattern <regex>` | `custom` 模式下的正则；缺失/非法时回退到 `default` |
| `--push` / `--no-push` | 合并完成后是否 push target 到远端，**未传则进入交互式询问**（询问光标默认落在「是」） |
| `--remote <name>` | push / 删除远程分支使用的 remote 名,默认 `origin` |
| `--delete-branches` / `--no-delete-branches` | 是否删除已合并分支(本地 + `<remote>/<x>` 跟踪 + 远程)，**未传则进入交互式询问**（询问光标默认落在「否」） |

```bash
# 直接进分支列表(默认筛选)
git-branch-merger -t main

# 自定义正则筛选 hotfix/ 开头分支
git-branch-merger -t main --filter custom --pattern '^hotfix/'

# 全部分支 + 推送 + 删除已合并分支
git-branch-merger -t main --filter all --push --delete-branches
```

## 流水线步骤

```
启动参数日志
  ↓
启动页(target + 筛选)         → 选定后写入日志
  ↓
分支列表页(多选合并顺序)       → 确认后写入日志
  ↓
配置询问(push / delete-branches) → 仅在 CLI 未显式传参时出现
  ↓
合并阶段(worktree 中依次 merge) → 每分支结果写入日志
  ↓
push 阶段(可跳过)              → push 结果写入日志
  ↓
删除分支阶段(可跳过)           → 每分支删除结果写入日志,清理新建的 worktree
  ↓
直接退出 CLI(无需按键)
```

冲突或致命错误会立刻终止流程并展示 worktree 路径，CLI 仍直接退出，所有日志保留在 stdout。

### 启动页

按顺序选择 **target** 与 **筛选条件**：

- 默认筛选：`^(feature|bugfix)/`
- 全部分支
- 自定义正则（非法时回退为子串匹配）

### 分支列表页

只显示**未合入 target 且符合筛选**的分支，每个分支带未合入 commit 数；超过 10 个会高亮 `⚠ >10`。

| 按键 | 行为 |
|---|---|
| ↑/↓ 或 j/k | 移动光标 |
| 空格 | 切换选中（行前缀 `[N]` 表示第 N 个被选，即合并顺序） |
| e 或 回车 | 展开当前分支的全部未合入 commit |
| g | 按已选顺序开始合并 |
| b 或 Esc | 返回启动页 |

### Commit 详情页（展开后）

按 commit title 列表展示，可继续打开任一 commit 查看完整 body：

| 按键 | 行为 |
|---|---|
| ↑/↓ 或 j/k | 移动光标 |
| 回车 或 o | 打开当前 commit 的 body 视图（sha / 作者 / 时间 / 标题 / 正文） |
| b / Esc / q | 返回 |

Body 视图按任意键返回 title 列表。

### 合并阶段

按选择顺序在 worktree 内依次执行 `git merge <branch>`（默认策略，可 ff 时 ff）：

- 全部成功 → 进入 push 阶段
- 冲突 / 错误 → 立即终止流程并保留 worktree

### Push 阶段

仅在 `--push` 时执行：在合并所用的 git 实例（worktree 或主工作区）上 `git push <remote> <target>`。
失败会终止流程，保留 worktree 以便处理。

### 删除分支阶段

仅在 `--delete-branches` 时执行：对刚刚合并的每个分支依次执行

```
git branch -D <branch>            # 本地
git branch -d -r <remote>/<branch> # 本地缓存的远程跟踪
git push <remote> --delete <branch> # 远端
```

每条独立计成功/失败，全部尝试完毕后写入日志。
完成后（或跳过删除时）若先前是新建的 worktree,会自动清理。

## Worktree 行为

合并永远不在你的当前工作区进行：

| 当前所在分支 | 行为 |
|---|---|
| 即 target | 不创建 worktree，原地合并 |
| 非 target，已有其他 worktree checkout 了 target | **复用**，结束后**不**删除 |
| 非 target，target 未被任何 worktree checkout | 新建 `.claude/worktrees/<sanitized-target>-<rand>`，全部成功后清理；冲突/push 失败时保留 |

## 项目结构

```
src/
├── index.ts              # bin 入口，解析 CLI 参数
├── app.tsx               # 顶层状态机 + Static 日志渲染
├── git.ts                # GitService(simple-git 封装,含 worktree / push / 删除)
└── screens/
    ├── StartScreen.tsx
    ├── BranchListScreen.tsx
    ├── MergeScreen.tsx
    ├── PushScreen.tsx
    ├── DeleteScreen.tsx
    └── ResultScreen.tsx
```

关键实现：

- **Stage 单一对象类型**：通过可选字段表达不同阶段，跨步骤切换不丢失 `selection / chosen / branches / outcomes / worktreePath / pushOutcome / deleteOutcomes` 等上下文
- **日志保留**：App 维护 logs 数组,顶层 `<Static>` 渲染,每个步骤结束追加日志,新一步的 UI 在动态区显示但旧日志永久留在 stdout
- **自动退出**：ResultScreen 在 mount 时把最终状态写入日志后立即调用 `useApp().exit()`,无需按键
- **未合入计数并发**：`git rev-list --count <target>..<branch>` 用 `Promise.all` 并发统计
- **commit 详情**：`git log --pretty=format:%H\x1f%an\x1f%ad\x1f%s\x1f%b\x1e` 用 0x1F/0x1E 不可见控制字符做字段/记录分隔，避免与 commit message 冲突
- **worktree**：`git worktree list --porcelain` / `add` / `remove --force` 三个 raw 命令封装为 `findWorktreeForBranch / addWorktree / removeWorktree`
- **多选自实现**：`useInput` + 空格；未使用 `ink-multi-select`，因其 2.0.0 (CJS) 与 ink 5 (ESM + top-level await) 不兼容（运行时 `require() cannot be used on an ESM graph with top-level await`）
- **target 不校验**：`-t` 注入直接信任，传错由后续 git 命令自然报错；按返回键时清空 injectedTarget 避免状态不一致
- **回退保留上下文**：list → start 回退保留 `chosen`，重选 target 后会自动剔除新筛选结果中已不存在的分支

## 要求

- Node ≥ 18
- pnpm
- 当前目录是有效的 git 仓库

## 已知限制

- 冲突仅检测，不在 CLI 内提供 abort/continue，需手动到 worktree 处理
- 删除分支时若某分支正在被另一个 worktree 占用,本地删除会失败,记录到日志但不阻塞其他分支
