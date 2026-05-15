var mongoose = require('mongoose')
var Schema = mongoose.Schema

const RELATION_SOURCES = ['manual', 'aiOrganize', 'translationWorkflow']

var sourcePostProperNounRelations = new Schema(
  {
    sourceCollection: {
      type: String,
      default: 'posts',
      index: true
    },
    sourceId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true
    },
    sourceLanguageCode: {
      type: String,
      default: '',
      index: true
    },
    termId: {
      type: Schema.Types.ObjectId,
      ref: 'properNounTerms',
      required: true,
      index: true
    },
    relationSource: {
      type: String,
      enum: RELATION_SOURCES,
      default: 'manual',
      index: true
    },
    sourceTitleSnapshot: {
      type: String,
      default: ''
    },
    sourceAliasSnapshot: {
      type: String,
      default: ''
    },
    note: {
      type: String,
      default: ''
    },
    lastOrganizedAt: {
      type: Date,
      default: null,
      index: true
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  { timestamps: true }
)

sourcePostProperNounRelations.index(
  {
    sourceCollection: 1,
    sourceId: 1,
    termId: 1
  },
  { unique: true }
)
sourcePostProperNounRelations.index({
  sourceCollection: 1,
  sourceId: 1,
  enabled: 1,
  updatedAt: -1
})

module.exports = require('../modelFactory/defaultModel')(
  'sourcePostProperNounRelations',
  sourcePostProperNounRelations
)
