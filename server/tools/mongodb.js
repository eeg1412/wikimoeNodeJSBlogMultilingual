console.error(
  '多语言站仓库禁止通过 server/tools/mongodb.js 直接连接源站数据库。请在源站仓库执行源站维护脚本。'
)
process.exit(1)
