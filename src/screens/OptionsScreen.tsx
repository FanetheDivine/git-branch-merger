import React, { useState } from 'react'
import { Box, Text } from 'ink'
import SelectInput from 'ink-select-input'

interface Props {
  askPush: boolean
  askDelete: boolean
  initialPush: boolean
  initialDelete: boolean
  remote: string
  onSubmit: (pushEnabled: boolean, deleteBranchesEnabled: boolean) => void
}

const YES_NO_ITEMS: Array<{ label: string; value: boolean; key: string }> = [
  { label: '是', value: true, key: 'yes' },
  { label: '否', value: false, key: 'no' },
]

export const OptionsScreen: React.FC<Props> = ({
  askPush,
  askDelete,
  initialPush,
  initialDelete,
  remote,
  onSubmit,
}) => {
  const [step, setStep] = useState<'push' | 'delete'>(askPush ? 'push' : 'delete')
  const [pushEnabled, setPushEnabled] = useState<boolean>(initialPush)

  if (step === 'push') {
    return (
      <Box flexDirection='column'>
        <Text bold>
          合并完成后是否 push 到远端 <Text color='cyan'>{remote}</Text>？
        </Text>
        <SelectInput
          key='push'
          items={YES_NO_ITEMS}
          initialIndex={initialPush ? 0 : 1}
          onSelect={(item) => {
            setPushEnabled(item.value)
            if (askDelete) {
              setStep('delete')
            } else {
              onSubmit(item.value, initialDelete)
            }
          }}
        />
      </Box>
    )
  }

  return (
    <Box flexDirection='column'>
      <Text bold>是否在合并完成后删除已合入分支（本地 / {remote} 跟踪 / 远端）？</Text>
      <SelectInput
        key='delete'
        items={YES_NO_ITEMS}
        initialIndex={initialDelete ? 0 : 1}
        onSelect={(item) => {
          onSubmit(askPush ? pushEnabled : initialPush, item.value)
        }}
      />
    </Box>
  )
}
