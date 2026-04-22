import { execSync } from 'child_process'

console.log('=== Install and build admin ===')
execSync('cd admin && npm install && npm run build', {
  stdio: 'inherit',
  shell: true
})

console.log('=== Install server dependencies ===')
execSync('cd server && npm install', { stdio: 'inherit', shell: true })

console.log('=== Install and build blog CSS ===')
execSync('cd blog && npm install && npm run build:css', {
  stdio: 'inherit',
  shell: true
})

console.log('=== Build complete ===')
