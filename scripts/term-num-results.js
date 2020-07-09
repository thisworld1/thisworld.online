const fs = require('fs')
  , req = require('superagent')

const baseApi = process.env.API_URL || `https://thisworld.online/api`

;(async function() {
  const terms = require('../terms.json')

  await Promise.all(
    Object.entries(terms).map(async ([ _, term ]) => {
      term.num_results = await req.get(`${baseApi}/search?q=${encodeURIComponent(term.query)}`)
        .then(res => res.body.paging.total)
    })
  )

  console.log(JSON.stringify(terms, '\t', 2))
})()
