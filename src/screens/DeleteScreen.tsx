import React, { useEffect, useRef, useState } from 'react'
import { Box, Text } from 'ink'
import { DeleteOutcome } from '../app.js'
import { GitService } from '../git.js'

interface Props {
  git: GitService
  target: string
  branches: string[]
  remote: string
  enabled: boolean
  worktreePath: string | null
  worktreeCreated: boolean
  onDone: (outcomes: DeleteOutcome[], cleanedWorktree: boolean, cleanupError?: string) => void
}

export const DeleteScreen: React.FC<Props> = ({
  git,
  target,
  branches,
  remote,
  enabled,
  worktreePath,
  worktreeCreated,
  onDone,
}) => {
  const [outcomes, setOutcomes] = useState<DeleteOutcome[]>([])
  const [current, setCurrent] = useState<string | null>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const collected: DeleteOutcome[] = []

      if (enabled) {
        for (const branch of branches) {
          if (cancelled) return
          if (branch === target) continue
          setCurrent(branch)
          const local = await git.deleteLocalBranch(branch)
          const remoteTracking = await git.deleteRemoteTrackingBranch(remote, branch)
          const remoteRes = await git.deleteRemoteBranch(remote, branch)
          collected.push({
            branch,
            local: local.ok ? { ok: true } : { ok: false, message: local.message },
            remoteTracking: remoteTracking.ok
              ? { ok: true }
              : { ok: false, message: remoteTracking.message },
            remote: remoteRes.ok ? { ok: true } : { ok: false, message: remoteRes.message },
          })
          setOutcomes([...collected])
        }
      }

      let cleaned = false
      let cleanupError: string | undefined
      if (worktreeCreated && worktreePath) {
        try {
          await git.removeWorktree(worktreePath)
          cleaned = true
        } catch (err: any) {
          cleanupError = String(err?.message ?? err)
        }
      }

      if (!cancelled) onDoneRef.current(collected, cleaned, cleanupError)
    })()
    return () => {
      cancelled = true
    }
  }, [git, target, branches, remote, enabled, worktreePath, worktreeCreated])

  if (!enabled) {
    return <Text dimColor>跳过分支删除…</Text>
  }

  return (
    <Box flexDirection='column'>
      <Text bold>正在删除已合并分支(本地 / {remote} 跟踪 / 远端)…</Text>
      {outcomes.map((o) => (
        <Text key={o.branch}>
          {o.local.ok && o.remoteTracking.ok && o.remote.ok ? (
            <Text color='green'>✓</Text>
          ) : (
            <Text color='yellow'>!</Text>
          )}{' '}
          {o.branch}
          {'  '}
          local={o.local.ok ? '✓' : '✗'} {remote}/={o.remoteTracking.ok ? '✓' : '✗'} remote=
          {o.remote.ok ? '✓' : '✗'}
        </Text>
      ))}
      {current && !outcomes.some((o) => o.branch === current) && (
        <Text color='yellow'>… 删除 {current}</Text>
      )}
    </Box>
  )
}
