var express = require('express')
var router = express.Router()

router.get('/:type?', function (req, res) {
  res.status(404).send('Not found')
})

module.exports = router
