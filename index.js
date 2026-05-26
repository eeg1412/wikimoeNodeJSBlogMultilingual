const { execSync } = require('child_process')

const shouldBuild = process.argv.includes('--build')

function run(command) {
  execSync(command, {
    stdio: 'inherit'
  })
}

if (shouldBuild) {
  run('yarn --cwd admin install')
  run('yarn --cwd admin build')
  run('yarn --cwd server install')
}

run('yarn --cwd server run start')
