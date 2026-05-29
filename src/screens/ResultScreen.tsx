import React, { useEffect } from 'react'
import { Box, Text } from 'ink'
import { DeleteOutcome, MergeOutcome, PushOutcome } from '../app.js'

interface Props {
  outcomes: MergeOutcome[]
  aborted: boolean
  worktreePath: string | null
  worktreeCleaned: boolean
  pushOutcome: PushOutcome | null
  deleteOutcomes: DeleteOutcome[]
}

export const ResultScreen: React.FC<Props> = ({
  outcomes,
  worktreePath,
  worktreeCleaned,
  pushOutcome,
  deleteOutcomes,
}) => {
  useEffect(() => {
    setTimeout(() => process.exit(0), 80)
  }, [])

  const conflict = outcomes.find((o) => o.status === 'conflict')
  const error = outcomes.find((o) => o.status === 'error')
  const failedDeletes = deleteOutcomes.filter(
    (o) => !o.local.ok || !o.remoteTracking.ok || !o.remote.ok,
  )
  const showWorktree = worktreePath && !worktreeCleaned

  return (
    <Box flexDirection='column'>
      {conflict && (
        <Box flexDirection='column'>
          <Text color='red' bold>
            合并冲突: {conflict.branch}
          </Text>
          {showWorktree && <Text color='yellow'>worktree {worktreePath}</Text>}
          <Text>解决步骤: 1) 解决冲突文件  2) git add ...  3) git commit  4) 重新运行本工具</Text>
          {conflict.message && <Text dimColor>详情: {conflict.message.split(/\r?\n/)[0]}</Text>}
        </Box>
      )}
      {!conflict && error && (
        <Box flexDirection='column'>
          <Text color='red'>错误: {error.message ?? ''}</Text>
          {showWorktree && <Text color='yellow'>worktree {worktreePath}</Text>}
        </Box>
      )}
      {pushOutcome && !pushOutcome.ok && (
        <Box flexDirection='column'>
          <Text color='red' bold>
            push 失败: {pushOutcome.message ?? ''}
          </Text>
          {showWorktree && <Text color='yellow'>worktree {worktreePath}</Text>}
        </Box>
      )}
    </Box>
  )
}
