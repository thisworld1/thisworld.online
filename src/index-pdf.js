const { basename } = require('path')
    , { promisify } = require('util')
    , cp = require('child_process')
    , execFile = promisify(cp.execFile)
    , { range } = require('./util')

const pdftotextBin = cp.execSync('which pdftotext').toString().trim()
    , exiftoolBin  = cp.execSync('which exiftool').toString().trim()

const solr = require('solr-client').createClient(process.env.SOLR_HOST, process.env.SOLR_PORT, process.env.SOLR_CORE)

solr.add = promisify(solr.add)
solr.commit = promisify(solr.commit)
solr.autoCommit = !!process.env.SOLR_AUTOCOMMIT

;(async paths => {
  for (let i=0; i<paths.length; i++) await indexFile(paths[i])
  await solr.commit()
})(process.argv.slice(2))

async function indexFile(path) {
  const filename = basename(path)
  const { issue_num, date, year } = parseName(filename)

  console.log(`indexing issue #${issue_num} ${date} at ${path}`)

  const pages = await extractPages(path)

  const res = await solr.add({
    type: 'issue'
  , id: issue_num
  , issue_num
  , filename
  , date
  , year
  , page_count: pages.length
  , pages: pages.map(page => ({
      type: 'page'
    , id: `${issue_num}-p${page.num}`
    , page_num: page.num
    , page_content: cleanText(page.content)
    // denormalize parent data inside the child
    , year, date, filename
    }))
  }, { commitWithin: 60000 })

  console.log(`indexed issue #${issue_num} ${date}`, res)

  // autoCommit does not appear to work
  if (solr.autoCommit) await solr.commit()
}

async function extractPages(path) {
  const page_count = await getPageCount(path)
      , page_nums = range(1, page_count)

  return Promise.all(
    page_nums.map(async num => ({
      num: num
    , content: await extractPage(path, num)
    }))
  )
}

const extractPage = (path, num) =>
  extractText(path, '-nopgbrk', '-f', num, '-l', num)

async function extractText(path, ...opt) {
  const { stdout, stderr } = await execFile(pdftotextBin, [ ...opt, path, '-' ], { maxBuffer: 1024*1024*10 })

  if (stderr) { console.error('pdototext stderr:', stderr) }
  return stdout
}

function parseName(filename) {
  const m = filename.match(/^B-I(\d+)-D(\d{2})(\d{2})(\d{2})\.pdf$/)
  if (!m) throw new Error(`Invalid filename ${filename}`)
  return {
    issue_num: +m[1],
    date: `19${m[4]}-${m[3]}-${m[2]}T12:00:00Z`,
    year: +`19${m[4]}`
  }
}

async function getPageCount(path) {
  const out = await execFile(exiftoolBin, [ '-PageCount', '-s', '-s', '-s', path ])
  return +out.stdout
}

function cleanText(text) {
  // control characters
  text = text
    // remove POP DIRECTIONAL FORMATTING characters
    .replace(/[\u202a-\u202c]/gu, '')
    // remove control characters except for newlines and soft hypens
    .replace(/[^\P{C}\n\u00AD]/gu, '')
    // remove "Other Symbols" (symbols except math, currency and modifiers)
    .replace(/\p{So}/gu, '')

  // normalize spacing
  text = text
    .trim()
    .replace(/^ +| +$/mg, '') // trim on every line
    .replace(/\n{3,}/g, '\n\n') // avoid excessive newlines
    .replace(/ {2,}/g, ' ') // avoid excessive spaces

  // use canonical punctuation
  text = text
    .replace(/["“”]/g, '״')
    .replace(/['‘’]/g, '׳')

  // all parentheses got reversed by the OCR reader, flip them back
  text = text.replace(/[()]/g, s => s == '(' ? ')' : '(')

  // try fixing comma, dot, colon and question mark position
  text = text
    .replace(/([א-ת]) ([,.:])([א-ת])/g, '$1$2 $3')
    .replace(/([א-ת]) \?/g, '$1?')

  // space numbers followed by letters, letters followed by numbers,
  // and final form ("sofit") letters appearing in the middle of words
  text = text
    .replace(/(\d{2,})([א-ת]{2,})/g, '$1 $2')
    .replace(/([א-ת]{2,})(\d{2,})/g, '$1 $2')
    .replace(/([םןךףץ])([א-ת])/g, '$1 $2')

  // merge lines connected with a soft hyphen
  text = text
    .replace(/\u00AD\n([^ ]+)/gu, '$1\n') // try to keep the newline, but relocate it between words
    .replace(/\u00AD\n?/gu, '')

  // merge lines connected with a "maqaf" hyphen that was possibly actually a misidentified
  // soft hyphen, but keep the maqaf in case it wasn't misidentification
  text = text.replace(/([א-יכלמנ-עפצ-ת])־\n([א-ת][^ ]*)/g, '$1־$2\n')

  // connect single-word lines
  text = text.replace(/\n([א-ת\d]+)\n([א-ת\d]{3,})/g, ' $1 $2')

  // connect letters separated by space
  text = text.replace(/([^א-ת]|^)([א-ת](?: [א-ת]){2,})([^א-ת]|$)/gm
    , (_, pre, s, post) => pre + s.replace(/ /g, '') + post)

  // avoid excessive punctuation
  text = text
    .replace(/-{3,}/g, '--')
    .replace(/_{3,}/g, '__')
    .replace(/\.{4,}/g, '...')

  text = text.split(/\n/)
    // filter lines that contain little text
    .map(line => isMeaningful(line) ? line : '')
    .join("\n")

  // remove long sequences of non-alphanumeric characters
  text = text.replace(/[^\p{L}\p{N}\n]{5,}/ug, ' ')

  // normalize spacing (again)
  text = text
    .trim()
    .replace(/^ +| +$/mg, '') // trim on every line
    .replace(/\n{3,}/g, '\n\n') // avoid excessive newlines
    .replace(/ {2,}/g, ' ') // avoid excessive spaces

  return text
}

const isMeaningful = text => {
  if (text.replace(/[^\p{L}\p{N}]/ug, '').length < 3) return false;

  // require at least 40% of the characters to be alphanumeric and 50% to be alphanumeric+space
  const ratio_non_alphanum = text.replace(/[\p{L}\p{N}]/gu, '').length / text.length
      , ratio_non_alphanumspace = text.replace(/[\p{L}\p{N} ]/gu, '').length / text.length
  return ratio_non_alphanum < 0.6 && ratio_non_alphanumspace < 0.5
}
