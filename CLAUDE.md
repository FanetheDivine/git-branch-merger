# 分支合并工具 (git-branch-merger)

交互式终端 CLI，把多个本地分支按选定顺序依次合并到 target，可选 push、可选删除被合并分支。基于 `ink` (React in terminal) + `simple-git`，合并永远发生在专用 worktree 里，不污染当前工作区。

## 技术栈

- **运行时**：Node ≥ 18，ESM (`"type": "module"`)
- **TUI**：`ink` 5（ESM + top-level await）+ `ink-select-input` + `ink-text-input`
- **Git**：`simple-git`，关键 worktree 操作走 `git.raw(...)`
- **语言**：TypeScript，`tsc` 直接编译到 `dist/`，无打包器
- **包管理**：pnpm

## 项目结构

```
src/
├── index.ts              # bin 入口，解析 CLI 参数
├── app.tsx               # 顶层状态机 + Static 日志渲染 + 顶部状态视图
├── git.ts                # GitService(simple-git 封装,含 worktree / push / 删除)
└── screens/
    ├── StartScreen.tsx       # target 输入 + 筛选模式
    ├── BranchListScreen.tsx  # 多选合并顺序，含 commit 详情子视图
    ├── OptionsScreen.tsx     # push / delete-branches 交互式询问
    ├── MergeScreen.tsx       # worktree 中依次 merge
    ├── PushScreen.tsx        # push target 到远端
    ├── DeleteScreen.tsx      # 清理本地/跟踪/远程分支 + 清理 worktree
    └── ResultScreen.tsx      # 写入最终日志后自动 exit
```

## 核心设计

### Stage 状态机

`app.tsx` 中的 `Stage` 是单一对象类型，通过可选字段表达不同阶段：

```
start → list → (options) → merging → pushing → deleting → result
```

跨步骤切换不丢 `selection / chosen / branches / outcomes / worktreePath / pushOutcome / deleteOutcomes`。`options` 仅在 `--push` / `--delete-branches` 至少一个未显式传参时出现。

### 日志保留

App 维护 `logs: string[]`，顶层用 `<Static items={logs}>` 渲染，每个步骤结束追加日志。新一步的 UI 在动态区显示，旧日志永久留在 stdout，不被覆盖。`styleLog()` 按文本前缀/关键词上色（绿=成功、红=失败、黄=警示、蓝=进行中、灰=辅助）。

### 顶部状态视图（stateView）

`app.tsx` 的 `stateView` 渲染当前已选 target 与已选分支序号；进入 `result` 阶段后隐藏，避免与最终日志重复。

### 自动退出

`ResultScreen` 在 mount 时把最终状态写入 `onLog`，然后立即 `useApp().exit()`。无需按键，所有日志保留在 stdout。

### Worktree 策略

合并永远不在用户当前工作区进行：

| 当前所在分支 | 行为 |
|---|---|
| 即 target | 不创建 worktree，原地合并 |
| 非 target，已有其他 worktree checkout 了 target | **复用**，结束后**不**删除 |
| 非 target，target 未被任何 worktree checkout | 新建 `.claude/worktrees/<sanitized-target>-<rand>`，全部成功后清理；冲突/push 失败时保留 |

`worktreeCreated` 标志区分"是否由本次新建"，决定是否在结尾清理。

### CLI 参数与交互的关系

`index.ts` 的 `parseArgs` 把命令行映射成 `AppProps`。其中 `pushExplicit` / `deleteBranchesExplicit` 标记"用户显式给值"，未显式时 `pushEnabled` / `deleteBranchesEnabled` 留 `undefined`，触发 `OptionsScreen` 询问；询问完才确定布尔值进入下一步。

| 参数 | 说明 |
|---|---|
| `-t, --target <branch>` | 指定 target，**直接信任不校验**，传错由后续 git 报错兜底 |
| `--filter default\|all\|custom` | 筛选模式，默认 `default`(`^(feature\|bugfix)/`) |
| `--pattern <regex>` | `custom` 模式正则；缺失/非法回退到 `default` |
| `--push` / `--no-push` | 未传则交互询问（光标默认「是」） |
| `--remote <name>` | push / 删除远程分支用的 remote 名，默认 `origin` |
| `--delete-branches` / `--no-delete-branches` | 未传则交互询问（光标默认「否」） |

### Commit 详情解析

`git log --pretty=format:%H\x1f%an\x1f%ad\x1f%s\x1f%b\x1e` 用 0x1F (字段分隔) / 0x1E (记录分隔) 不可见控制字符，避免与 commit message 内容冲突。

### 多选自实现

`BranchListScreen` 用 `useInput` + 空格键自管理选中态，**不**用 `ink-multi-select`：其 2.0.0 (CJS) 与 ink 5 (ESM + top-level await) 不兼容，运行时报 `require() cannot be used on an ESM graph with top-level await`。

### 未合入计数并发

`BranchListScreen` 在拉到候选分支后，用 `Promise.all` 并发跑 `git rev-list --count <target>..<branch>`，超过 10 高亮 `⚠ >10`。

### 回退保留上下文

`list → start` 回退保留 `chosen`，重选 target 后会自动剔除新筛选结果中已不存在的分支。返回时会清空 `injectedTarget` 避免和用户后续输入冲突。

## 常见操作

```bash
pnpm i
pnpm build           # tsc → dist/
pnpm dev             # tsc --watch
pnpm start           # node dist/index.js
pnpm link --global   # 安装全局 git-branch-merger 命令
```

## 已知限制

- 冲突仅检测，不在 CLI 内提供 abort/continue，需手动到 worktree 处理
- 删除分支时若某分支被另一个 worktree 占用，本地删除会失败，记录到日志但不阻塞其他分支
- target 不校验，传错会在合并阶段才暴露
