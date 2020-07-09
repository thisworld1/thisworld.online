const categoryNames = [ 'כללי', 'התרחשויות ואירועים', 'אנשים', 'גופים וארגונים' ]

module.exports = path => {
  let slug

  const terms = require(path).map(t => ({
    ...t
  , slug: slug = t.label.replace(/ /g, '-')
  , href: `term/${encodeURIComponent(slug)}`
  }))

  terms.sort((a, b) => a.label < b.label ? -1 : 1)

  const termsMap = terms.reduce((O, t) => (O[t.slug] = t, O), {})

  const termsCat = terms.reduce((C, t) =>
    ((C[t.category] = C[t.category] || []).push(t), C)
  , {})

  const categories = categoryNames.map(name => ({
    name
  , slug: slug = name.replace(/ /g, '-')
  , href: `terms#${encodeURIComponent(slug)}`
  , terms: termsCat[name].sort((a, b) => b.num_results - a.num_results)
  , max_num_results: Math.max(...termsCat[name].map(t => t.num_results))
  }))

  const pickTerms = (seed, num) => {
    return shuffle(terms.slice(), hashCode(seed)).slice(0, num)
  }

  const pickHomeTerms = (num_per_category = 10) => {
    const seed = Date.now() / 1209600000 | 0

    return categories.map(category => ({
      ...category
    , terms: shuffle(category.terms.filter(t => t.home !== false).slice(), seed).slice(0, num_per_category)
    })).map(category => ({
      ...category
    , max_num_results: Math.max(...category.terms.map(t => t.num_results))
    , terms: category.terms.sort((a, b) => b.num_results - a.num_results)
    }))
  }

  const get = slug => termsMap[slug]

  return { get, pickTerms, pickHomeTerms, categories }
}

function hashCode(str) {
  var hash = 0, i, chr;
  for (i = 0; i < str.length; i++) {
    chr   = str.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

function shuffle(array, seed) {
  let currentIndex = array.length, temporaryValue, randomIndex;
  let random = function() {
    var x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };
  while (0 !== currentIndex) {
    randomIndex = Math.floor(random() * currentIndex);
    currentIndex -= 1;
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }
  return array;
}
