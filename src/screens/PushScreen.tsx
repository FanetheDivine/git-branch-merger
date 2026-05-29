import React, { useEffect, useRef, useState } from 'react'
import { Box, Text } from 'ink'
import { PushOutcome } from '../app.js'
import { GitService } from '../git.js'

interface Props {
  git: GitService
  target: string
  remote: string
  enabled: boolean
  worktreePath: string | null
  onLog: (...lines: string[]) => void
  onDone: (outcome: PushOutcome | null) => void
}

export const PushScreen: React.FC<Props> = ({
  git,
  target,
  remote,
  enabled,
  worktreePath,
  onLog,
  onDone,
}) => {
  const [done, setDone] = useState(false)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!enabled) {
        if (!cancelled) {
          setDone(true)
          onDoneRef.current(null)
        }
        return
      }
      const pushGit = worktreePath ? new GitService(worktreePath) : git
      const result = await pushGit.push(remote, target)
      if (cancelled) return
      setDone(true)
      onDoneRef.current(result.ok ? { ok: true } : { ok: false, message: result.message })
    })()
    return () => {
      cancelled = true
    }
  }, [git, target, remote, enabled, worktreePath, onLog])

  if (!enabled) {
    return <Text dimColor>跳过 push…</Text>
  }

  return (
    <Box flexDirection='column'>
      <Text bold>
        正在 push <Text color='cyan'>{target}</Text> 到 <Text color='cyan'>{remote}</Text>…
      </Text>
      {done && <Text dimColor>push 完成</Text>}
    </Box>
  )
}
