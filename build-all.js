const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const rootDir = __dirname
const isInstallOnly = process.argv.includes('--install-only')
let npmCommand = 'npm'

if (process.platform === 'win32') {
  npmCommand = 'npm.cmd'
}

function readPackageJson(projectDir) {
  const packageJsonPath = path.join(projectDir, 'package.json')
  if (!fs.existsSync(packageJsonPath)) {
    return null
  }

  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
}

function runNpm(args, projectDir, label) {
  console.log(`[${label}] ${npmCommand} ${args.join(' ')}`)
  execSync(`${npmCommand} ${args.join(' ')}`, {
    cwd: projectDir,
    stdio: 'inherit'
  })
}

function installProject(relativeDir, label) {
  const projectDir = path.join(rootDir, relativeDir)
  const packageJson = readPackageJson(projectDir)

  if (!packageJson) {
    console.log(`[${label}] 跳过，未找到 package.json`)
    return
  }

  runNpm(['install'], projectDir, label)

  if (!isInstallOnly && packageJson.scripts && packageJson.scripts.build) {
    runNpm(['run', 'build'], projectDir, label)
  }
}

installProject('.', 'root')
installProject('server', 'server')
installProject('admin', 'admin')
installProject('blog', 'blog')
