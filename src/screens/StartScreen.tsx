import React, { useEffect, useState } from 'react'
import { Box, Text } from 'ink'
import SelectInput from 'ink-select-input'
import TextInput from 'ink-text-input'
import { FilterMode, Selection } from '../app.js'
import { GitService } from '../git.js'

interface Props {
  git: GitService
  initialTarget?: string
  initialFilter?: FilterMode
  initialPattern?: string
  onSubmit: (selection: Selection) => void
  onError: (msg: string) => void
}

type Step = 'load' | 'target' | 'filter' | 'custom'

const FILTER_ITEMS: { label: string; value: FilterMode }[] = [
  { label: 'feature/*,bugfix/*', value: 'default' },
  { label: '全部', value: 'all' },
  { label: '自定义正则表达式', value: 'custom' },
]

export const StartScreen: React.FC<Props> = ({
  git,
  initialTarget,
  initialFilter,
  initialPattern,
  onSubmit,
  onError,
}) => {
  const [step, setStep] = useState<Step>(initialTarget ? 'filter' : 'load')
  const [branches, setBranches] = useState<string[]>([])
  const [target, setTarget] = useState<string>(initialTarget ?? '')
  const [filterMode, setFilterMode] = useState<FilterMode>(initialFilter ?? 'default')
  const [customPattern, setCustomPattern] = useState<string>(initialPattern ?? '')

  useEffect(() => {
    if (initialTarget) return
    git
      .listLocalBranches()
      .then((list) => {
        if (list.length === 0) {
          onError('当前仓库未发现本地分支')
          return
        }
        setBranches(list)
        setStep('target')
      })
      .catch((err) => onError(`读取分支失败: ${String(err?.message ?? err)}`))
  }, [git, initialTarget, onError])

  if (step === 'load') {
    return <Text>正在读取本地分支…</Text>
  }

  if (step === 'target') {
    const items = branches.map((b) => ({ label: b, value: b, key: b }))
    return (
      <Box flexDirection='column'>
        <Text bold>选择 target 分支（合入目标）：</Text>
        <SelectInput
          items={items}
          onSelect={(item) => {
            setTarget(item.value)
            setStep('filter')
          }}
        />
      </Box>
    )
  }

  if (step === 'filter') {
    return (
      <Box flexDirection='column'>
        <Text bold>选择分支筛选条件：</Text>
        <SelectInput
          items={FILTER_ITEMS.map((i) => ({ ...i, key: i.value }))}
          onSelect={(item) => {
            const mode = item.value as FilterMode
            setFilterMode(mode)
            if (mode === 'custom') {
              setStep('custom')
            } else {
              onSubmit({ target, filterMode: mode, customPattern: '' })
            }
          }}
        />
      </Box>
    )
  }

  return (
    <Box flexDirection='column'>
      <Text bold>
        输入自定义筛选正则（如 <Text color='cyan'>^hotfix/</Text>，回车确认）：
      </Text>
      <TextInput
        value={customPattern}
        onChange={setCustomPattern}
        onSubmit={(value) => {
          onSubmit({ target, filterMode, customPattern: value.trim() })
        }}
      />
    </Box>
  )
}
