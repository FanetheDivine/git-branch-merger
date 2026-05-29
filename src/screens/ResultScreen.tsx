import React, { useEffect } from 'react'
import { useApp } from 'ink'
import { DeleteOutcome, MergeOutcome, PushOutcome } from '../app.js'

interface Props {
  outcomes: MergeOutcome[]
  aborted: boolean
  worktreePath: string | null
  pushOutcome: PushOutcome | null
  deleteOutcomes: DeleteOutcome[]
  onLog: (...lines: string[]) => void
}

export const ResultScreen: React.FC<Props> = ({
  outcomes,
  aborted,
  worktreePath,
  pushOutcome,
  deleteOutcomes,
  onLog,
}) => {
  const { exit } = useApp()

  useEffect(() => {
    const lines: string[] = []

    const conflict = outcomes.find((o) => o.status === 'conflict')
    const error = outcomes.find((o) => o.status === 'error')
    if (conflict) {
      lines.push(`合并冲突: ${conflict.branch}`)
      if (worktreePath) lines.push(`worktree ${worktreePath}`)
      lines.push('解决步骤: 1) 解决冲突文件  2) git add ...  3) git commit  4) 重新运行本工具')
      if (conflict.message) lines.push(`详情: ${conflict.message.split(/\r?\n/)[0]}`)
    } else if (error) {
      lines.push(`错误: ${error.message ?? ''}`)
      if (worktreePath) lines.push(`worktree ${worktreePath}`)
    }

    if (pushOutcome && !pushOutcome.ok) {
      lines.push(`push 失败: ${pushOutcome.message ?? ''}`)
      if (worktreePath) lines.push(`worktree ${worktreePath}`)
    }

    const failedDeletes = deleteOutcomes.filter(
      (o) => !o.local.ok || !o.remoteTracking.ok || !o.remote.ok,
    )
    if (failedDeletes.length > 0) {
      lines.push(`分支删除有 ${failedDeletes.length} 项部分失败`)
    }

    if (lines.length > 0) onLog(...lines)
    exit()
    setTimeout(() => process.exit(0), 80)
  }, [])

  return null
}
