const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

function realpathSafe(targetPath) {
  try {
    if (fs.realpathSync.native) {
      return fs.realpathSync.native(targetPath)
    }
    return fs.realpathSync(targetPath)
  } catch (_) {
    return targetPath
  }
}

function uniquePaths(list) {
  const seen = new Set()
  const result = []
  for (const item of list) {
    if (!item || seen.has(item)) {
      continue
    }
    seen.add(item)
    result.push(item)
  }
  return result
}

function resolveNuxtBin(searchRoots) {
  for (const root of searchRoots) {
    try {
      const packageJsonPath = require.resolve('nuxt/package.json', {
        paths: [root]
      })
      const packageDir = path.dirname(packageJsonPath)
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
      const binField = packageJson.bin
      let relativeBinPath = ''

      if (typeof binField === 'string') {
        relativeBinPath = binField
      } else if (binField && typeof binField.nuxt === 'string') {
        relativeBinPath = binField.nuxt
      } else if (binField && typeof binField.nuxi === 'string') {
        relativeBinPath = binField.nuxi
      }

      if (!relativeBinPath) {
        continue
      }

      const resolvedBinPath = path.resolve(packageDir, relativeBinPath)
      if (fs.existsSync(resolvedBinPath)) {
        return resolvedBinPath
      }
    } catch (_) {
      continue
    }
  }
  return null
}

const packageRoot = path.resolve(__dirname, '..')
const realPackageRoot = realpathSafe(packageRoot)
const cwd = process.cwd()
const realCwd = realpathSafe(cwd)

const searchRoots = uniquePaths([
  packageRoot,
  realPackageRoot,
  cwd,
  realCwd,
  path.resolve(packageRoot, '..'),
  path.resolve(realPackageRoot, '..'),
  path.resolve(packageRoot, '../..'),
  path.resolve(realPackageRoot, '../..'),
  path.resolve(packageRoot, '../../..'),
  path.resolve(realPackageRoot, '../../..')
])

const nuxtBin = resolveNuxtBin(searchRoots)

if (!nuxtBin) {
  console.error('[prepare-nuxt] Failed to resolve nuxt/bin/nuxt.mjs')
  console.error('[prepare-nuxt] Search roots:')
  for (const root of searchRoots) {
    console.error(' - ' + root)
  }
  process.exit(1)
}

const result = spawnSync(process.execPath, [nuxtBin, 'prepare'], {
  cwd: realPackageRoot,
  stdio: 'inherit'
})

if (result.error) {
  console.error('[prepare-nuxt] Failed to run Nuxt prepare:', result.error)
  process.exit(1)
}

process.exit(result.status === null ? 1 : result.status)
