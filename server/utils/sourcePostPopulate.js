function buildSourcePostPopulate() {
  const matchStatus = { $in: [0, 1] }
  const sourceIdentitySelect =
    'languageCode sourceLanguageCode sourceId sourceCollection sourceSnapshotId translationGroupId recordKind snapshotVersion sourceSnapshotAt sourceUpdatedAt sourceHash'
  const postCoverPopulate = {
    path: 'coverImages',
    select: `filename filesize filepath thumfor width height thumWidth thumHeight mimetype album description is360Panorama status createdAt updatedAt ${sourceIdentitySelect}`
  }

  return [
    {
      path: 'author',
      select: '-password',
      populate: {
        path: 'cover'
      }
    },
    {
      path: 'sort',
      populate: {
        path: 'parent'
      }
    },
    { path: 'tags' },
    {
      path: 'mappointList',
      match: { status: matchStatus }
    },
    { path: 'coverImages' },
    {
      path: 'bangumiList',
      match: { status: matchStatus }
    },
    {
      path: 'movieList',
      match: { status: matchStatus }
    },
    {
      path: 'gameList',
      match: { status: matchStatus },
      populate: [{ path: 'gamePlatform' }, { path: 'screenshotAlbum' }]
    },
    {
      path: 'bookList',
      match: { status: matchStatus },
      populate: { path: 'booktype' }
    },
    {
      path: 'postList',
      match: { status: matchStatus, type: 1 },
      select: `title _id coverImages alias date status type excerpt updatedAt createdAt ${sourceIdentitySelect}`,
      populate: postCoverPopulate
    },
    {
      path: 'tweetList',
      match: { status: matchStatus, type: 2 },
      select: `title _id coverImages alias date status type excerpt updatedAt createdAt ${sourceIdentitySelect}`,
      populate: postCoverPopulate
    },
    {
      path: 'eventList',
      match: { status: matchStatus },
      populate: { path: 'eventtype' }
    },
    {
      path: 'voteList',
      match: { status: matchStatus }
    },
    {
      path: 'contentBangumiList',
      match: { status: matchStatus }
    },
    {
      path: 'contentMovieList',
      match: { status: matchStatus }
    },
    {
      path: 'contentGameList',
      match: { status: matchStatus },
      populate: [{ path: 'gamePlatform' }, { path: 'screenshotAlbum' }]
    },
    {
      path: 'contentBookList',
      match: { status: matchStatus },
      populate: { path: 'booktype' }
    },
    {
      path: 'contentPostList',
      match: { status: matchStatus, type: 1 },
      select: `title _id coverImages alias date status type excerpt updatedAt createdAt ${sourceIdentitySelect}`,
      populate: postCoverPopulate
    },
    {
      path: 'contentTweetList',
      match: { status: matchStatus, type: 2 },
      select: `title _id coverImages alias date status type excerpt updatedAt createdAt ${sourceIdentitySelect}`,
      populate: postCoverPopulate
    },
    {
      path: 'contentEventList',
      match: { status: matchStatus },
      populate: { path: 'eventtype' }
    },
    {
      path: 'contentVoteList',
      match: { status: matchStatus }
    }
  ]
}

module.exports = {
  buildSourcePostPopulate
}
