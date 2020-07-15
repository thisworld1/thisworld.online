const { p, apiPrefix, range, formatNum, makeAltText, formatPageText, pickTerms, getSnippetSummary } = require('./util')

const app = require('express')()
    , solr = require('solr-client').createClient(process.env.SOLR_HOST, process.env.SOLR_PORT, process.env.SOLR_CORE)
    , db = require('./model')(solr, process.env.BASE_ASSETS || '')
    , terms = require('./terms')(require.resolve('../terms.json'))
    , availableYears = range(1950, 1989)

app.set('view engine', 'pug')
Object.assign(app.locals, {
  baseHref: process.env.BASE_HREF || '/'
, baseStatic: process.env.BASE_STATIC || ''
, formatNum, makeAltText, formatPageText, getSnippetSummary
, availableYears
, pretty: (app.settings.env == 'development')
})

// cache the response "forever" (10 years)
const cacheForever = app.settings.env == 'production'
  ? res => res.set('Cache-Control', 'max-age=315569260')
  : res => {}

app.use(require('morgan')('dev'))
app.use(apiPrefix)

if (app.settings.env == 'development') {
  app.get('/style.css', require('stylus').middleware({ src: 'www', dest: 'www' }))
  app.use('/', require('express').static('www'))
}

// attach rterms to all responses that render an html view
app.use((req, res, next) => {
  const render = res.render
  res.render = (...a) => {
    res.locals.rterms = res.locals.rterms || terms.pickTerms(req.url, 2, false)
    return render.apply(res, a)
  }
  next()
})

app.get('/', p(async (req, res) => {
  const issues = await db.getRandomIssues(12)
      , rterms = terms.pickHomeTerms()
  res.set('Cache-Control', 'max-age=1') // short cache because of randomly-chosen issues
  res.format({
    html: _ => res.render('index', { issues, term_categories: rterms })
  })
}))

app.get('/about', (req, res) => res.format({
  html: _ => res.render('about')
}))

app.get('/archive', (req, res) => res.format({
  html: _ => res.render('archive')
}))

app.get('/:year(\\d{4})/:type(backpage)?', p(async (req, res, next) => {
  const year = +req.params.year
      , issues = await db.findByYear(year)

  if (!availableYears.includes(year)) return next()

  res.locals.show_backpage = req.params.type == 'backpage'

  cacheForever(res)
  res.format({
    html: _ => res.render('year', { year, issues })
  , json: _ => res.send(issues)
  })
}))

app.get('/:year(\\d{4})/:issue(\\d+)/:type(gallery)?', p(async (req, res, next) => {
  // xxx check year matches?
  const issue = await db.findByNum(req.params.issue)
  if (!issue) return next()

  if (issue.year != req.params.year)
    return res.redirect(301, `/${issue.year}/${req.url.substr(6)}`)

  Object.assign(res.locals, await db.getPrevNext(issue.issue_num))

  res.locals.show_gallery = req.params.type == 'gallery'

  cacheForever(res)
  res.format({
    html: _ => res.render('issue', { issue })
  , json: _ => res.send(issue)
  })
}))

app.get('/search', p(async (req, res, next) => {
  if (!req.query.q) return next()

  const { query, results, paging } = await db.findByKeyword(req.query)

  res.format({
    html: _ => res.render('search', { query, results, paging })
  , json: _ => res.send({ results, paging })
  })
}))

app.get('/suggest', p(async (req, res) => {
  if (!req.query.q) return res.sendStatus(400)
  res.send(await db.suggest(req.query.q.toString()))
}))

app.get('/terms', p(async (req, res) => {
  cacheForever(res)
  res.format({
    html: _ => res.render('terms', { term_categories: terms.categories })
  })
}))

app.get('/term/:term', p(async (req, res, next) => {
  const term = terms.get(req.params.term)
  if (!term) return next()

  const { query, results, paging } = await db.findByKeyword({ q: term.query })

  cacheForever(res)
  res.format({
    html: _ => res.render('term', { term, query, results, paging })
  , json: _ => res.send(results)
  })
}))

app.use((req, res, next) => res.format({
  html: _ => res.status(404).render('notfound')
, default: _ => res.sendStatus(404)
}))

const server = app.listen(process.env.PORT || 4433, _ =>
  console.log(`Server listening on ${server.address().address}:${server.address().port}`))

process.on('SIGINT', _ => process.exit())
process.on('SIGTERM', _ => process.exit())
