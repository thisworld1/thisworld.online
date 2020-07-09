const urlutil = require('url')

// utility function for promised express request handlers
const p = fn => (req, res, next) => fn(req, res, next).catch(next)

const range = (start, end) =>
  Array.from(Array(end - start + 1)).map((_, i) => start + i)

const pad = (n, len=2) => n.toString().padStart(len, '0')

const makeAltText = {
  issue: ({ issue_num, date_he }) =>
    `העולם הזה - גליון ${issue_num} - ${ date_he }`
, page: ({ page_num, page_content }, issue) =>
    `${ makeAltText.issue(issue) } - עמוד ${page_num} | ${getSnippetSummary(page_content)}`
, result: ({ issue_num, date_he, page_num, highlight }) =>
    `${ makeAltText.issue({ issue_num, date_he }) } - עמוד ${page_num} | ${getSnippetSummary(highlight)}`
}

const getSnippetSummary = text =>
  htmlDecode(
    text.replace(/<\/?em>/g, '')
        .replace(/\s+/g, ' ')
        .replace(/ *\n */g, ' ')
        .substr(0,160)
        .replace(/\s+\S*$/, '') // try to avoid cut words
  )

const formatPageText = text =>
  '<p>' + htmlEscape(text)
    .replace(/\n\n/g, '</p><p>') // format double line breaks as paragraphs
    .replace(/\n/g, '<br>\n') // format single line break as <br>
    .replace(/<\/p><p>/g, '</p>\n<p>')
+ '</p>'

const htmlEscape = string => string
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')

const htmlDecode = string => string
  .replace(/&quot;/g, '"')
  .replace(/&#39;/, '\'')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&')

const formatNum = s => {
  let [ whole, dec ] = s.toString().split('.')
  whole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return whole + (dec != null ? '.'+dec : '')
}

// middleware for handling the /api/ prefix
const apiPrefix = (req, res, next) => {
  if (req.url.startsWith('/api/')) {
    // rewrite requests to /api/ to accept application/json, and strip the /api/ prefix from the url.
    // this is later processed by the dual json/html route handlers using res.format().
    req.headers.accept = 'application/json'
    req.url = urlutil.format({
      ...urlutil.parse(req.url)
    , pathname: req.path.substr(4)
    })
  } else if (req.accepts('html', 'json') == 'json') {
    // don't accept application/json requests without the /api/ prefix.
    // this prevents json responses from being cached under the prefix-less url.
    return res.sendStatus(406) // not acceptable
  }

  next()
}

module.exports = { p, apiPrefix, range, pad, formatNum, makeAltText, formatPageText, htmlDecode, getSnippetSummary }
