const { promisify } = require('util')
    , qs = require('querystring')
    , { pad, htmlDecode } = require('./util')
    , enc = encodeURIComponent

const PER_PAGE = 25

const formatDate = time =>
  `${time.getUTCFullYear()}-${pad(time.getUTCMonth() + 1)}-${pad(time.getUTCDate())}`

const formatDateHeb = time =>
  `${time.getUTCDate()} ב${hebMonthNames[time.getUTCMonth()]} ${time.getUTCFullYear()}`

const hebMonthNames = [ 'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר' ]

const sortOptions = [ 'relevance', 'newest', 'oldest' ]

const yearsFilter = yearsStr => {
  const parts = yearsStr.trim().split(/\s*,\s*/)
  return '(' + parts.map(part => {
    const m = part.match(/^(\d{4})(?:-(\d{4}))?$/)
    if (!m) throw new Error('invalid year range')
    else if (m[2]) return `year:[${m[1]} TO ${m[2]}]`
    else return `year:${m[1]}`
  }).join(' OR ') + ')'
}

const extractMatchedTerms = highlight => {
  const terms = Array.from(highlight.matchAll(/<em>\s*([^<]+)\s*<\/em>/g)
    , x => htmlDecode(x[1]))
    .map(t => t.split('\n'))
    .flat()
  // Set and back for uniqueness
  return Array.from(new Set(terms))
}

// replace acronym quotes that appear in the middle of hebrew words with ״ (as they're indexed in the page content),
// instead of the " that imply a phrase search
const encodeSolrQuotes = s => s.replace(/([א-ת])"([א-ת])/g, '$1״$2').replace(/'/g, '׳')
    , decodeSolrQuotes = s => s.replace(/״/g, '"').replace(/׳/g, '\'')

module.exports = (solr, assets_base) => {
  // solr-client is supposed to be promisified, but it does not appear to work properly
  solr.add = promisify(solr.add)
  solr.search = promisify(solr.search)
  solr.get = promisify(solr.get)

  const imageUrl = (issue_num, page_num, type='t') =>
    `${assets_base}pages/${issue_num}/${type}-${page_num}.png`

  const pdfUrl = filename =>
    `${assets_base}pdfs/${filename}`

  const pdfPageUrl = (filename, issue_num, page_num) =>
     `${assets_base}spdf/${issue_num}/${filename.slice(0, -4)}-P${page_num}.pdf`

  const formatIssue = issue => {
    const time = new Date(issue.date)
    return {
      issue_num: issue.issue_num
    , page_count: issue.page_count
    , date: formatDate(time)
    , date_he: formatDateHeb(time)
    , year: time.getUTCFullYear()
    , href: `${time.getUTCFullYear()}/${issue.issue_num}`
    , pdf: pdfUrl(issue.filename)
    , coverpage: imageUrl(issue.issue_num, 1, 't')
    , backpage: imageUrl(issue.issue_num, issue.page_count, 't')
    }
  }

  const formatPageResult = (page, highlight) => {
    const issue_num = +page._nest_parent_
        , time = new Date(page.date)
        , issue_href = `${time.getUTCFullYear()}/${issue_num}`
        , highlight_str = highlight.page_content.join(' ')

    return {
      issue_num
    , issue_href
    , date: formatDate(time)
    , date_he: formatDateHeb(time)

    , page_num: page.page_num
    , href: `${issue_href}#p${page.page_num}`
    , pdf: pdfPageUrl(page.filename, issue_num, page.page_num)
    , image: imageUrl(issue_num, page.page_num, 'f')
    , thumbnail: imageUrl(issue_num, page.page_num, 't')
    , highlight: highlight_str
    , terms: extractMatchedTerms(highlight_str)
    }
  }

  async function search(q) {
    console.log('search', q)
    const r = await solr.search(q)
    if (r.responseHeader.status !== 0)
      throw new Error(`invalid solr status: ${ r.responseHeader.status }`)
    return r
  }

  async function findByNum(issue_num) {
    const r = await search(solr.createQuery()
      .matchFilter('type', 'issue')
      .q({ issue_num })
      .restrict('*,[child limit=150 fl=page_num,page_content]') // we should never have more than 150 childs
      .rows(1)
    )
    if (!r.response.numFound) return null

    const issue = formatIssue(r.response.docs[0])
        , filename = r.response.docs[0].filename

    issue.pages = r.response.docs[0].pages.map(page => ({
      page_num: page.page_num
    , href: `${issue.year}/${issue.issue_num}#p${page.page_num}`
    , pdf: pdfPageUrl(filename, issue.issue_num, page.page_num)
    , image: imageUrl(issue.issue_num, page.page_num, 'f')
    , thumbnail: imageUrl(issue.issue_num, page.page_num, 't')
    , page_content: page.page_content
    }))

    return issue
  }

  async function findByYear(year){
    const r = await search(solr.createQuery()
      .matchFilter('type', 'issue')
      .q({ year })
      .sort({ issue_num: 'asc' })
      .restrict('id,issue_num,date,filename,page_count')
      .rows(100) // we have up to 52 weekly issues in a year, this should get everything
    )

    return r.response.docs.map(formatIssue)
  }

  async function getRandomIssues(limit) {
    const r = await search(solr.createQuery()
      .matchFilter('type', 'issue')
      .q({ '*': '*' })
      .sort({ [`random_${Math.random()*100000|0}`]: 'asc' })
      .restrict('id,issue_num,date,filename,page_count')
      .rows(limit)
    )

    return r.response.docs.map(formatIssue)
  }

  async function findByKeyword(uquery) {
    const keyword = (uquery.q||'').toString()
        , start   = +uquery.start || 0
        , sort    = sortOptions.includes(uquery.sort) ? uquery.sort : 'relevance'

    let years  = (uquery.years||'').toString()

    const filters = [ 'type:page' ]
    if (years) {
      try { filters.push(yearsFilter(years)) }
      catch (err) { years = '' }
    }

    const getUrl = (u_start=0, u_sort=sort) => {
      const urlQuery = { q: keyword }
      if (years != '') urlQuery.years = years
      if (u_start != 0) urlQuery.start = u_start
      if (u_sort != 'relevance') urlQuery.sort = u_sort
      return `search?${ qs.stringify(urlQuery) }`
    }
    const query = { q: keyword, years, start, sort, getUrl }

    const q = solr.createQuery()
      .defType('simple')
      .set(`fq=${enc(filters.join(' AND '))}`)
      .df('page_content')
      .set('q.op=and')
      .q(encodeSolrQuotes(keyword))
      .restrict('id,_nest_parent_,date,filename,page_num')
      .start(+start || 0)
      .rows(PER_PAGE)
      .set('hl=true&hl.method=unified&hl.fl=page_content&hl.encoder=html' +
          '&hl.defaultSummary=true&hl.snippets=3&hl.tag.ellipsis=%20%E2%80%A6%20' +
          '&hl.maxAnalyzedChars=500000')

    if (sort != 'relevance') {
      q.sort({ date: (sort == 'newest' ? 'desc' : 'asc'), page_num: 'asc' })
    }

    const r = await search(q)

    const paging = {
      per_page: PER_PAGE
    , total: r.response.numFound
    , start: start
    , next: (r.response.numFound > start + PER_PAGE ? start + PER_PAGE : null)
    , prev: (start >= PER_PAGE ? start - PER_PAGE : null)
    }

    const results = r.response.docs.map(page =>
      formatPageResult(page, r.highlighting[page.id]))

    return { query, results, paging }
  }

  async function suggest(query, limit=10) {
    // trailing slashes results in weird suggestions being returned
    query = encodeSolrQuotes(query.trimStart().replace(/"+$/, ''))

    const r = await solr.get('suggest', `suggest.dictionary=suggester&suggest.count=${limit}&suggest.q=${enc(query)}`)
        , key = Object.keys(r.suggest.suggester)[0]
        , isPhrase = query[0] == '"'
        , queryPrefix = query.replace(/[^ ]+ *$/, '') || (isPhrase ? '"' : '')

    const suggestions = r.suggest.suggester[key].suggestions
      .map(suggestion => queryPrefix + suggestion.term.replace(/^[^ ]+\u001E/u, ''))
      .map(suggestion => suggestion + (isPhrase && suggestion.indexOf('"', 1) == -1 ? '"' : ''))
      .map(decodeSolrQuotes)

    // make list unique
    return Array.from(new Set(suggestions))
  }

  return { findByNum, findByYear, findByKeyword, getRandomIssues, suggest }
}

