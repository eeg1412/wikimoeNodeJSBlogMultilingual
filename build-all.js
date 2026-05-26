const { execSync } = require('child_process')

function run(command) {
  execSync(command, {
    stdio: 'inherit'
  })
}

console.log('install and build admin')
run('yarn --cwd admin install')
run('yarn --cwd admin build')

console.log('install server')
run('yarn --cwd server install')
