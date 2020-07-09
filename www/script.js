;(function() {
  tippy('[data-tippy-content]', { allowHTML: true, placement: 'bottom' })

  //
  // Year selector
  //
  $('.year-select').change(function() {
    const year = $(this).val()
        , isBackpage = location.href.includes('/backpage')
    if (year) location.href = year + (isBackpage ? '/backpage' : '')
  })

  //
  // Jump to issue number
  //
  $('.issue-num-select').submit(function(e) {
    e.preventDefault()
    location.href = `0000/${$(this).find('[name=issue-num]').val()}`
  })

  //
  // Refresh
  //
  $('.do-refresh').click(e => (e.preventDefault(), location.reload()))

  //
  // Back to top
  // Cannot be done without JavaScript due to the use of <base href>
  //
  $('.back-to-top').click(e => window.scrollTo(0, 0))

  //
  // Search autocomplete
  //
  $("[name=q]").autoComplete({
    bootstrapVersion: '4'
  , minLength: 2
  , events: {
      searchPost: results => {
        // hack to hide "no results" message, just don't display anything if we don't have suggestions
        const action = results.length ? 'add' : 'remove'
        setTimeout(_ => $('.bootstrap-autocomplete .dropdown-menu')[`${action}Class`]('show'), 0)
        return results
      }
    }
  })

  // search suggestion when clicked
  $('form').on('click', '.bootstrap-autocomplete', ev => {
    ev.preventDefault()
    $(ev.target).closest('form').submit()
  })

  //
  // Hover-to-enlarge
  //
  $('.enlarge').hover(
    ev => updateImg(ev.currentTarget.querySelector('img'), 'm')
  , ev => updateImg(ev.currentTarget.querySelector('img'), 't')
  )
  $('.enlarge img').on('error', detachAltImg)

  let _last
  function updateImg(img, change_to) {
    // switch between high and low resolutions
    if (!img.dataset.noAltImg) {
      img.src = img.src.replace(/\/[tm](-\d+\.png)$/, `/${change_to}\$1`)
    }


    // hack to prevent z-index flickering when quickly moving between enlarged images
    if (change_to == 'm') {
      if (_last) {
        const l = _last // keep current last in block closure for setTimeout below
        l.className += ' no-anim' // no css animations, reset z-index immediately
        l.style.zIndex = ''
        setTimeout(_ => l.className = l.className.replace(/\bno-anim\b/g, ''), 0)
      }
      _last = $(img).closest('.enlarge-container')[0]
    }
  }
  function detachAltImg(ev) {
    // if we fail loading the alternative larger image, give up on trying
    // to avoid buggy browser flickers
    updateImg(ev.currentTarget, 't')
    ev.currentTarget.dataset.noAltImg = true
  }

  //
  // Highlight
  //

  // set keywords to highlight on localStorage when following a link
  // that has highlight keywords associated with it
  $('[data-search-hl] a').on('click mousedown', function(ev) {
    const ds = $(this).closest('[data-search-hl]')[0].dataset
    localStorage[`search_hl_${this.pathname}`] = ds.searchHl
  })

  // catch saved highlight words and highlight
  const hl_key = `search_hl_${location.pathname}`
  if (localStorage[hl_key]) {
    const terms = localStorage[hl_key].split('|')
    localStorage.removeItem(hl_key) // highlight only once

    new Mark('.text-view').mark(terms, { accuracy: 'complementary', separateWordSearch: false })

    const page_num = getHashPageId()
        , found = page_num && document.querySelector(`.text-view [data-page="${page_num}"] mark`)
    if (found) setTimeout(_ => found.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }), 300)
  }

  function getHashPageId() {
    const m = location.hash.match(/^#p(\d+)$/)
    return m ? m[1] : null
  }

  // Used to disable hover-to-enlarge on touch devices
  if ('ontouchstart' in document.documentElement) {
    document.body.classList.add('touch-device')
  }
})()
