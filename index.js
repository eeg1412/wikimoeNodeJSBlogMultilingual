const concurrently = require('concurrently')

const { result } = concurrently(
  [
    {
      command: 'npm run dev --prefix server',
      name: 'server',
      prefixColor: 'blue'
    },
    {
      command: 'npm run dev --prefix admin',
      name: 'admin',
      prefixColor: 'yellow'
    },
    {
      command: 'npm run dev --prefix blog',
      name: 'blog',
      prefixColor: 'green'
    }
  ],
  {
    prefix: 'name',
    killOthers: ['failure']
  }
)

result.catch(error => {
  console.error('dev process exited', error)
  process.exit(1)
})