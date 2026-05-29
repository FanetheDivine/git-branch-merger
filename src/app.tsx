import React, { useMemo, useState } from 'react'
import { Box, Text, useApp, useInput } from 'ink'
import { GitService } from './git.js'
import { BranchListScreen } from './screens/BranchListScreen.js'
import { DeleteScreen } from './screens/DeleteScreen.js'
import { MergeScreen } from './screens/MergeScreen.js'
import { OptionsScreen } from './screens/OptionsScreen.js'
import { PushScreen } from './screens/PushScreen.js'
import { ResultScreen } from './screens/ResultScreen.js'
import { StartScreen } from './screens/StartScreen.js'

export type FilterMode = 'default' | 'all' | 'custom'

export interface Selection {
  target: string
  filterMode: FilterMode
  customPattern: string
}

export interface MergeOutcome {
  branch: string
  status: 'success' | 'conflict' | 'error'
  message?: string
}

export interface PushOutcome {
  ok: boolean
  message?: string
}

export interface DeleteOutcome {
  branch: string
  local: { ok: boolean; message?: string }
  remoteTracking: { ok: boolean; message?: string }
  remote: { ok: boolean; message?: string }
}

export type Step = 'start' | 'list' | 'options' | 'merging' | 'pushing' | 'deleting' | 'result'

type LogStyle = { color?: string; bold?: boolean; dimColor?: boolean }

function styleLog(line: string): LogStyle {
  if (line.startsWith('目标分支 ')) return { color: 'cyan', bold: true }
  if (line === '已选分支') return { bold: true }
  if (/^\d+\.\s/.test(line)) {
    if (line.includes('(已合并)')) return { color: 'green' }
    if (line.includes('(冲突)') || line.includes('(失败)')) return { color: 'red' }
    return { color: 'blue' }
  }
  if (line.startsWith('worktree ')) return { color: 'yellow' }
  if (line === '所有分支已合并') return { color: 'green', bold: true }
  if (line === '已推送至远程') return { color: 'green', bold: true }
  if (line === '已删除合并的分支') return { color: 'green', bold: true }
  if (line === '已清理 worktree') return { color: 'gray' }
  if (line.includes('worktree 清理失败')) return { color: 'yellow' }
  return {}
}

export interface Stage {
  step: Step
  selection?: Selection
  chosen?: string[]
  branches?: string[]
  outcomes?: MergeOutcome[]
  aborted?: boolean
  worktreePath?: string | null
  worktreeCreated?: boolean
  worktreeCleaned?: boolean
  worktreeCleanupError?: string
  pushOutcome?: PushOutcome | null
  deleteOutcomes?: DeleteOutcome[]
  pushEnabled?: boolean
  deleteBranchesEnabled?: boolean
}

export interface AppProps {
  initialTarget?: string
  initialFilter?: FilterMode
  initialPattern?: string
  pushEnabled?: boolean
  pushExplicit?: boolean
  deleteBranchesEnabled?: boolean
  deleteBranchesExplicit?: boolean
  remote?: string
}

function normalizeFilter(
  mode: FilterMode | undefined,
  pattern: string | undefined,
): { mode: FilterMode; pattern: string } | null {
  if (!mode) return null
  if (mode === 'custom') {
    const raw = (pattern ?? '').trim()
    if (!raw) return { mode: 'default', pattern: '' }
    try {
      new RegExp(raw)
    } catch {
      return { mode: 'default', pattern: '' }
    }
    return { mode: 'custom', pattern: raw }
  }
  return { mode, pattern: '' }
}

function computeInitial(props: AppProps): Stage {
  const { initialTarget, initialFilter, initialPattern } = props
  if (!initialTarget) return { step: 'start' }
  const normalized = normalizeFilter(initialFilter, initialPattern)
  if (!normalized) {
    return {
      step: 'start',
      selection: { target: initialTarget, filterMode: 'default', customPattern: '' },
    }
  }
  return {
    step: 'list',
    selection: {
      target: initialTarget,
      filterMode: normalized.mode,
      customPattern: normalized.pattern,
    },
  }
}

export const App: React.FC<AppProps> = (props) => {
  const pushExplicit = props.pushExplicit ?? false
  const deleteBranchesExplicit = props.deleteBranchesExplicit ?? false
  const remote = props.remote ?? 'origin'

  const { exit } = useApp()
  const [git] = useState(() => new GitService(process.cwd()))
  const [stage, setStage] = useState<Stage>(() => {
    const init = computeInitial(props)
    return {
      ...init,
      pushEnabled: pushExplicit ? props.pushEnabled : undefined,
      deleteBranchesEnabled: deleteBranchesExplicit ? props.deleteBranchesEnabled : undefined,
    }
  })
  const [injectedTarget, setInjectedTarget] = useState<string | undefined>(props.initialTarget)
  const [injectedFilter, setInjectedFilter] = useState<{
    mode: FilterMode
    pattern: string
  } | null>(() => normalizeFilter(props.initialFilter, props.initialPattern))
  const [error, setError] = useState<string | null>(null)

  useInput((_input, key) => {
    if (key.ctrl && _input === 'c') exit()
  })

  const stateView = useMemo(() => {
    const lines: string[] = []
    if (stage.selection?.target) {
      lines.push(`目标分支 ${stage.selection.target}`)
    }
    const sel = stage.chosen ?? []
    if (sel.length > 0) {
      lines.push('已选分支')
      sel.forEach((branch, idx) => {
        let suffix = ''
        const outcome = stage.outcomes?.find((o) => o.branch === branch)
        if (outcome) {
          if (outcome.status === 'success') suffix = ' (已合并)'
          else if (outcome.status === 'conflict') suffix = ' (冲突)'
          else suffix = ' (失败)'
        }
        lines.push(`${idx + 1}. ${branch}${suffix}`)
      })
    }
    if (stage.worktreePath && !stage.worktreeCleaned) {
      lines.push(`worktree ${stage.worktreePath}`)
    }
    const pastMerge =
      stage.step === 'pushing' || stage.step === 'deleting' || stage.step === 'result'
    if (
      !stage.aborted &&
      pastMerge &&
      stage.outcomes &&
      stage.outcomes.length > 0 &&
      stage.outcomes.every((o) => o.status === 'success')
    ) {
      lines.push('所有分支已合并')
    }
    if (stage.pushOutcome?.ok) lines.push('已推送至远程')
    if (stage.deleteBranchesEnabled && stage.deleteOutcomes !== undefined) {
      lines.push('已删除合并的分支')
    }
    if (stage.worktreeCleaned) lines.push('已清理 worktree')
    if (stage.worktreeCleanupError) {
      lines.push(`worktree 清理失败: ${stage.worktreeCleanupError}`)
    }
    return lines
  }, [stage])

  const renderActive = () => {
    if (error) {
      return <Text color='red'>错误: {error}</Text>
    }

    if (stage.step === 'start') {
      return (
        <StartScreen
          git={git}
          initialTarget={injectedTarget}
          initialFilter={injectedFilter?.mode}
          initialPattern={injectedFilter?.pattern}
          onSubmit={(selection) => {
            setStage((prev) => ({ ...prev, step: 'list', selection }))
          }}
          onError={(msg) => setError(msg)}
        />
      )
    }

    if (stage.step === 'list' && stage.selection) {
      return (
        <BranchListScreen
          git={git}
          selection={stage.selection}
          chosen={stage.chosen ?? []}
          onChosenChange={(chosen) => setStage((prev) => ({ ...prev, chosen }))}
          onConfirm={(branches) => {
            setStage((prev) => {
              const needAsk =
                prev.pushEnabled === undefined || prev.deleteBranchesEnabled === undefined
              return {
                ...prev,
                step: needAsk ? 'options' : 'merging',
                branches,
                chosen: branches,
              }
            })
          }}
          onError={(msg) => setError(msg)}
        />
      )
    }

    if (stage.step === 'options' && stage.selection && stage.branches) {
      const askPush = stage.pushEnabled === undefined
      const askDelete = stage.deleteBranchesEnabled === undefined
      return (
        <OptionsScreen
          askPush={askPush}
          askDelete={askDelete}
          initialPush={stage.pushEnabled ?? false}
          initialDelete={stage.deleteBranchesEnabled ?? false}
          remote={remote}
          onSubmit={(push, del) => {
            setStage((prev) => ({
              ...prev,
              step: 'merging',
              pushEnabled: push,
              deleteBranchesEnabled: del,
            }))
          }}
        />
      )
    }

    if (stage.step === 'merging' && stage.selection && stage.branches) {
      return (
        <MergeScreen
          git={git}
          target={stage.selection.target}
          branches={stage.branches}
          onDone={(outcomes, aborted, worktreePath, worktreeCreated) => {
            setStage((prev) => ({
              ...prev,
              step: aborted ? 'result' : 'pushing',
              outcomes,
              aborted,
              worktreePath,
              worktreeCreated,
            }))
          }}
        />
      )
    }

    if (stage.step === 'pushing' && stage.selection) {
      const pushOn = stage.pushEnabled ?? false
      return (
        <PushScreen
          git={git}
          target={stage.selection.target}
          remote={remote}
          enabled={pushOn}
          worktreePath={stage.worktreePath ?? null}
          onDone={(outcome) => {
            const pushFailed = pushOn && outcome && !outcome.ok
            setStage((prev) => ({
              ...prev,
              step: pushFailed ? 'result' : 'deleting',
              pushOutcome: outcome,
              aborted: pushFailed ? true : prev.aborted,
            }))
          }}
        />
      )
    }

    if (stage.step === 'deleting' && stage.selection && stage.branches) {
      const deleteOn = stage.deleteBranchesEnabled ?? false
      return (
        <DeleteScreen
          git={git}
          target={stage.selection.target}
          branches={stage.branches}
          remote={remote}
          enabled={deleteOn}
          worktreePath={stage.worktreePath ?? null}
          worktreeCreated={stage.worktreeCreated ?? false}
          onDone={(outcomes, cleanedWorktree, cleanupError) => {
            setStage((prev) => ({
              ...prev,
              step: 'result',
              deleteOutcomes: outcomes,
              worktreeCleaned: cleanedWorktree,
              worktreeCleanupError: cleanupError,
            }))
          }}
        />
      )
    }

    if (stage.step === 'result') {
      return (
        <ResultScreen
          outcomes={stage.outcomes ?? []}
          aborted={stage.aborted ?? false}
          worktreePath={stage.worktreePath ?? null}
          worktreeCleaned={stage.worktreeCleaned ?? false}
          pushOutcome={stage.pushOutcome ?? null}
          deleteOutcomes={stage.deleteOutcomes ?? []}
        />
      )
    }

    return <Text color='red'>非法状态</Text>
  }

  return (
    <Box flexDirection='column'>
      {stateView.length > 0 && (
        <Box flexDirection='column'>
          {stateView.map((line, idx) => {
            const style = styleLog(line)
            return (
              <Text key={idx} {...style}>
                {line}
              </Text>
            )
          })}
        </Box>
      )}
      {renderActive()}
    </Box>
  )
}
