import { build, context } from 'esbuild'

const stubDevtools = {
  name: 'stub-devtools',
  setup(b) {
    b.onResolve({ filter: /^react-devtools-core$/ }, (args) => ({
      path: args.path,
      namespace: 'stub-devtools',
    }))
    b.onLoad({ filter: /.*/, namespace: 'stub-devtools' }, () => ({
      contents: 'export default {}',
      loader: 'js',
    }))
  },
}

const options = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/index.js',
  platform: 'node',
  format: 'esm',
  target: 'node18',
  jsx: 'transform',
  plugins: [stubDevtools],
  banner: {
    js: "import { createRequire as __createRequire } from 'module';\nconst require = __createRequire(import.meta.url);",
  },
  legalComments: 'none',
  logLevel: 'info',
}

if (process.argv.includes('--watch')) {
  const ctx = await context(options)
  await ctx.watch()
} else {
  await build(options)
}
