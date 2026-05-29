#!/usr/bin/env node
import React from 'react'
import { render } from 'ink'
import { App, AppProps, FilterMode } from './app.js'

function parseArgs(argv: string[]): AppProps {
  const props: AppProps = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '-t' || a === '--target') {
      props.initialTarget = argv[++i]
    } else if (a === '--filter') {
      const v = argv[++i]
      if (v === 'default' || v === 'all' || v === 'custom') {
        props.initialFilter = v as FilterMode
      }
    } else if (a === '--pattern') {
      props.initialPattern = argv[++i]
    } else if (a === '--push') {
      props.pushEnabled = true
      props.pushExplicit = true
    } else if (a === '--no-push') {
      props.pushEnabled = false
      props.pushExplicit = true
    } else if (a === '--remote') {
      props.remote = argv[++i]
    } else if (a === '--delete-branches') {
      props.deleteBranchesEnabled = true
      props.deleteBranchesExplicit = true
    } else if (a === '--no-delete-branches') {
      props.deleteBranchesEnabled = false
      props.deleteBranchesExplicit = true
    }
  }
  return props
}

process.on('SIGINT', () => process.exit(130))

const props = parseArgs(process.argv.slice(2))
const instance = render(React.createElement(App, props), { exitOnCtrlC: false })
instance.waitUntilExit().catch(() => {
  process.exit(130)
})
