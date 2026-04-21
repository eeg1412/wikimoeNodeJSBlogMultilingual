// 统一模型入口，按文件名加载
module.exports = {
  AdminUsers: require('./adminUsers'),
  Authors: require('./authors'),
  Sorts: require('./sorts'),
  Tags: require('./tags'),
  Mappoints: require('./mappoints'),
  Attachments: require('./attachments'),
  Bangumis: require('./bangumis'),
  Movies: require('./movies'),
  Games: require('./games'),
  Books: require('./books'),
  Events: require('./events'),
  Votes: require('./votes'),
  Posts: require('./posts'),
  ImportJobs: require('./importJobs'),
  TranslationMemories: require('./translationMemories'),
  AITranslationLogs: require('./aiTranslationLogs'),
  Options: require('./options')
}
