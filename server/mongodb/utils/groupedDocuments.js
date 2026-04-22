const LANGUAGE_ORDER = ['en', 'jp', 'tw']

function buildSortStage(sort) {
  const sortStage = {}
  const entries = Object.entries(sort || {})

  if (entries.length === 0) {
    sortStage.updatedAt = -1
    sortStage.createdAt = -1
    sortStage._id = 1
    return sortStage
  }

  for (const [field, direction] of entries) {
    sortStage[field] = direction
  }

  if (sortStage._id === undefined) {
    sortStage._id = 1
  }

  return sortStage
}

function getLanguageOrder(languageCode) {
  const index = LANGUAGE_ORDER.indexOf(languageCode)
  if (index === -1) {
    return LANGUAGE_ORDER.length
  }
  return index
}

function sortLangEntries(entries) {
  return [...(entries || [])].sort((left, right) => {
    const orderDelta =
      getLanguageOrder(left.languageCode) - getLanguageOrder(right.languageCode)

    if (orderDelta !== 0) {
      return orderDelta
    }

    const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime()
    const rightTime = new Date(
      right.updatedAt || right.createdAt || 0
    ).getTime()

    return rightTime - leftTime
  })
}

function pickPrimaryEntry(entries) {
  const sortedEntries = sortLangEntries(entries)

  for (const languageCode of LANGUAGE_ORDER) {
    const matchedEntry = sortedEntries.find(
      entry => entry.languageCode === languageCode
    )
    if (matchedEntry) {
      return matchedEntry
    }
  }

  if (sortedEntries.length > 0) {
    return sortedEntries[0]
  }

  return null
}

export async function findGroupedDocumentPage({
  Model,
  query = {},
  page = 1,
  limit = 20,
  groupField = 'sourceId',
  preGroupSort = {}
} = {}) {
  const { languageCode, ...baseQuery } = query
  const skip = (page - 1) * limit

  const pipeline = [
    { $match: baseQuery },
    { $sort: buildSortStage(preGroupSort) },
    {
      $group: {
        _id: `$${groupField}`,
        docs: { $push: '$$ROOT' },
        latestUpdatedAt: { $max: '$updatedAt' },
        latestCreatedAt: { $max: '$createdAt' }
      }
    }
  ]

  if (languageCode) {
    pipeline.push({
      $match: {
        'docs.languageCode': languageCode
      }
    })
  }

  pipeline.push(
    {
      $sort: {
        latestUpdatedAt: -1,
        latestCreatedAt: -1,
        _id: 1
      }
    },
    {
      $facet: {
        list: [{ $skip: skip }, { $limit: limit }],
        total: [{ $count: 'count' }]
      }
    }
  )

  const [result] = await Model.aggregate(pipeline)
  const groupedList = result?.list || []
  const total = result?.total?.[0]?.count || 0

  const list = groupedList.map(group => {
    const langs = sortLangEntries(group.docs)
    const primaryEntry = pickPrimaryEntry(langs)

    return {
      groupKey: group._id,
      sourceId: primaryEntry?.sourceId || group._id || '',
      sourceSnapshot:
        primaryEntry?.sourceSnapshot || primaryEntry?.rawData || null,
      langs,
      updatedAt: group.latestUpdatedAt || primaryEntry?.updatedAt || null,
      createdAt: group.latestCreatedAt || primaryEntry?.createdAt || null
    }
  })

  return { list, total }
}
