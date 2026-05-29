import React, { useEffect, useRef, useState } from 'react'
import { Box, Text } from 'ink'
import { randomBytes } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { MergeOutcome } from '../app.js'
import { GitService } from '../git.js'

interface Props {
  git: GitService
  target: string
  branches: string[]
  onDone: (
    outcomes: MergeOutcome[],
    aborted: boolean,
    worktreePath: string | null,
    worktreeCreated: boolean,
  ) => void
}

export const MergeScreen: React.FC<Props> = ({ git, target, branches, onDone }) => {
  const [outcomes, setOutcomes] = useState<MergeOutcome[]>([])
  const [current, setCurrent] = useState<string | null>(null)
  const [worktreeInfo, setWorktreeInfo] = useState<{ path: string; created: boolean } | null>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const collected: MergeOutcome[] = []
      let mergeGit: GitService = git
      let worktreePath: string | null = null
      let createdWorktree = false

      try {
        const currentBranch = await git.getCurrentBranch()
        if (currentBranch !== target) {
          const existing = await git.findWorktreeForBranch(target)
          if (existing) {
            worktreePath = existing
          } else {
            const sanitized = target.replace(/[^\w.-]/g, '_')
            const rand = randomBytes(3).toString('hex')
            worktreePath = path.resolve(
              process.cwd(),
              '.claude',
              'worktrees',
              `${sanitized}-${rand}`,
            )
            await fs.mkdir(path.dirname(worktreePath), { recursive: true })
            await git.addWorktree(worktreePath, target)
            createdWorktree = true
          }
          mergeGit = new GitService(worktreePath)
          if (!cancelled) {
            setWorktreeInfo({ path: worktreePath, created: createdWorktree })
          }
        }
      } catch (err: any) {
        const msg = `准备 worktree 失败: ${String(err?.message ?? err)}`
        if (!cancelled)
          onDoneRef.current([{ branch: target, status: 'error', message: msg }], true, null, false)
        return
      }

      for (const branch of branches) {
        if (cancelled) return
        setCurrent(branch)
        const result = await mergeGit.merge(branch)
        if (result.ok) {
          collected.push({ branch, status: 'success' })
          setOutcomes([...collected])
        } else if (result.conflict) {
          collected.push({ branch, status: 'conflict', message: result.message })
          if (!cancelled) onDoneRef.current(collected, true, worktreePath, createdWorktree)
          return
        } else {
          collected.push({ branch, status: 'error', message: result.message })
          if (!cancelled) onDoneRef.current(collected, true, worktreePath, createdWorktree)
          return
        }
      }

      if (!cancelled) onDoneRef.current(collected, false, worktreePath, createdWorktree)
    })()
    return () => {
      cancelled = true
    }
  }, [git, target, branches])

  return (
    <Box flexDirection='column'>
      <Text bold>
        正在依次合并到 <Text color='cyan'>{target}</Text>…
      </Text>
      {worktreeInfo && (
        <Text dimColor>
          {worktreeInfo.created ? '已创建 worktree' : '复用 worktree'}: {worktreeInfo.path}
        </Text>
      )}
      {outcomes.map((o) => (
        <Text key={o.branch} color='green'>
          ✓ {o.branch}
        </Text>
      ))}
      {current && !outcomes.some((o) => o.branch === current) && (
        <Text color='yellow'>… 合并 {current}</Text>
      )}
    </Box>
  )
}
