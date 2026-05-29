import React, { useEffect, useMemo, useState } from 'react'
import { Box, Text, useInput, useApp } from 'ink'
import { Selection } from '../app.js'
import { GitService, BranchInfo } from '../git.js'

interface Props {
  git: GitService
  selection: Selection
  chosen: string[]
  onChosenChange: (chosen: string[]) => void
  onConfirm: (branches: string[]) => void
  onError: (msg: string) => void
}

const DEFAULT_PATTERN = /^(feature|bugfix)\//
const TITLE_LIMIT = 10

interface BranchRow extends BranchInfo {
  titles: string[]
}

function buildMatcher(selection: Selection): (name: string) => boolean {
  if (selection.filterMode === 'all') return () => true
  if (selection.filterMode === 'default') return (n) => DEFAULT_PATTERN.test(n)
  const raw = selection.customPattern
  if (!raw) return () => true
  try {
    const re = new RegExp(raw)
    return (n) => re.test(n)
  } catch {
    return (n) => n.includes(raw)
  }
}

// 注:ink-multi-select 2.0.0 (2020) 仅兼容 ink 3 (CJS),无法 require ink 5 (ESM + TLA),
// 运行时报错 "require() cannot be used on an ESM graph with top-level await"。
// 因此此处使用 useInput + 空格自实现多选,以保留按选择顺序合并的语义。
export const BranchListScreen: React.FC<Props> = ({
  git,
  selection,
  chosen,
  onChosenChange,
  onConfirm,
  onError,
}) => {
  const { exit } = useApp()
  const [loading, setLoading] = useState(true)
  const [branches, setBranches] = useState<BranchRow[]>([])
  const [cursor, setCursor] = useState(0)

  const matcher = useMemo(() => buildMatcher(selection), [selection])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const all = await git.listLocalBranches()
        const filtered = all.filter((b) => b !== selection.target && matcher(b))
        const counts = await Promise.all(
          filtered.map((b) => git.countUnmerged(selection.target, b)),
        )
        const candidates: { name: string; unmergedCount: number }[] = []
        filtered.forEach((b, i) => {
          if (counts[i] > 0) candidates.push({ name: b, unmergedCount: counts[i] })
        })
        const titles = await Promise.all(
          candidates.map((c) =>
            git.listUnmergedCommitTitles(selection.target, c.name, TITLE_LIMIT),
          ),
        )
        const rows: BranchRow[] = candidates.map((c, i) => ({ ...c, titles: titles[i] }))
        if (!cancelled) {
          setBranches(rows)
          const validNames = new Set(rows.map((i) => i.name))
          const pruned = chosen.filter((c) => validNames.has(c))
          if (pruned.length !== chosen.length) onChosenChange(pruned)
          setLoading(false)
        }
      } catch (err: any) {
        onError(`读取分支信息失败: ${String(err?.message ?? err)}`)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [git, selection, matcher, onError])

  useInput((input, key) => {
    if (loading) return
    if (key.upArrow || input === 'k') {
      setCursor((c) => Math.max(0, c - 1))
    } else if (key.downArrow || input === 'j') {
      setCursor((c) => Math.min(branches.length - 1, c + 1))
    } else if (input === ' ') {
      const cur = branches[cursor]
      if (!cur) return
      const next = chosen.includes(cur.name)
        ? chosen.filter((n) => n !== cur.name)
        : [...chosen, cur.name]
      onChosenChange(next)
      if (cursor < branches.length - 1) setCursor(cursor + 1)
    } else if (key.return) {
      if (chosen.length === 0) return
      onConfirm(chosen)
    }
  })

  if (loading) {
    return <Text>正在统计未合入 commit…</Text>
  }

  return (
    <Box flexDirection='column'>
      <Text>
        未合入分支 {branches.length} 个；已选 {chosen.length} 个（按选择顺序合并）
      </Text>
      <Box flexDirection='column' marginY={1}>
        {branches.length === 0 && <Text dimColor>没有符合条件的未合入分支。</Text>}
        {branches.map((b, i) => {
          const isCursor = i === cursor
          const order = chosen.indexOf(b.name)
          const mark = order >= 0 ? `[${order + 1}]` : '[ ]'
          const big = b.unmergedCount > 10
          return (
            <Box key={b.name} flexDirection='column'>
              <Text>
                <Text color={isCursor ? 'magenta' : undefined}>{isCursor ? '▶ ' : '  '}</Text>
                <Text color={order >= 0 ? 'green' : undefined}>{mark}</Text>{' '}
                <Text bold={isCursor}>{b.name}</Text>{' '}
                <Text color={big ? 'red' : 'gray'} bold={big}>
                  ({b.unmergedCount} commits{big ? ' ⚠ >10' : ''})
                </Text>
              </Text>
              {b.titles.map((t, ti) => (
                <Text key={ti} dimColor>
                  {'      • '}
                  {t}
                </Text>
              ))}
            </Box>
          )
        })}
      </Box>
      <Text dimColor>↑/↓ 移动　空格选择　回车确认</Text>
    </Box>
  )
}
