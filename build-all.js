const { execSync } = require('child_process')

const commands = [
  'npm install --prefix admin',
  'npm run build --prefix admin',
  'npm install --prefix server',
  'npm run build --prefix server',
  'npm install --prefix blog',
  'npm run build --prefix blog'
]

for (const command of commands) {
  console.log(`run: ${command}`)
  execSync(command, { stdio: 'inherit' })
}