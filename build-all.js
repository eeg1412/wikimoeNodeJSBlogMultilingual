const { execSync } = require('child_process')
const path = require('path')

function run(cmd, cwd) {
  console.log(`\n[build-all] ${cmd}  (cwd=${cwd})`)
  execSync(cmd, { cwd, stdio: 'inherit', shell: true })
}

const root = __dirname

try {
  run('npm install', root)
  run('npm run build', path.join(root, 'admin'))
  run('npm run build', path.join(root, 'blog'))
  console.log('\n[build-all] 全部构建完成')
} catch (err) {
  console.error('\n[build-all] 构建失败:', err.message)
  process.exit(1)
}
