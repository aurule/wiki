// ------------------------------------
// Markdown - Timeline Preprocessor
// ------------------------------------

module.exports = function timelinePlugin(md, options) {
  const isSpace = md.utils.isSpace

  // Search `[:~][\n ]`, returns next pos after marker on success
  // or -1 on fail.
  function skipMarker(state, line) {
    var pos, marker,
        start = state.bMarks[line] + state.tShift[line],
        max = state.eMarks[line];

    if (start >= max) { return -1; }

    // Check bullet
    marker = state.src.charCodeAt(start++);
    if (marker !== 0x7E/* ~ */ && marker !== 0x3A/* : */) { return -1; }

    pos = state.skipSpaces(start);

    // require space after ":"
    if (start === pos) { return -1; }

    // no empty definitions, e.g. "  : "
    if (pos >= max) { return -1; }

    return start;
  }

  function validateDefault(params, markup) {
    return params.trim().split(' ', 2)[0] === 'timeline'
  }

  options = options || {};
  const min_markers = 3,
      marker_str  = options.marker || ':',
      marker_char = marker_str.charCodeAt(0),
      marker_len  = marker_str.length,
      validate    = options.validate || validateDefault;

  function timeline (state, startLine, endLine, silent) {
    var pos, nextLine, marker_count, markup, params, token,
        old_parent, old_line_max,
        auto_closed = false,
        start = state.bMarks[startLine] + state.tShift[startLine],
        max = state.eMarks[startLine];

    // Check out the first character quickly,
    // this should filter out most of non-containers
    //
    if (marker_char !== state.src.charCodeAt(start)) { return false; }

    // Check out the rest of the marker string
    //
    for (pos = start + 1; pos <= max; pos++) {
      if (marker_str[(pos - start) % marker_len] !== state.src[pos]) {
        break;
      }
    }

    marker_count = Math.floor((pos - start) / marker_len);
    if (marker_count < min_markers) { return false; }
    pos -= (pos - start) % marker_len;

    markup = state.src.slice(start, pos);
    params = state.src.slice(pos, max);
    if (!validate(params, markup)) { return false; }

    // Since start is found, we can report success here in validation mode
    //
    if (silent) { return true; }

    // Search for the end of the block
    //
    nextLine = startLine;

    for (;;) {
      nextLine++;
      if (nextLine >= endLine) {
        // unclosed block should be autoclosed by end of document.
        // also block seems to be autoclosed by end of parent
        break;
      }

      start = state.bMarks[nextLine] + state.tShift[nextLine];
      max = state.eMarks[nextLine];

      if (start < max && state.sCount[nextLine] < state.blkIndent) {
        // non-empty line with negative indent should stop the list:
        // - ```
        //  test
        break;
      }

      if (marker_char !== state.src.charCodeAt(start)) { continue; }

      if (state.sCount[nextLine] - state.blkIndent >= 4) {
        // closing fence should be indented less than 4 spaces
        continue;
      }

      for (pos = start + 1; pos <= max; pos++) {
        if (marker_str[(pos - start) % marker_len] !== state.src[pos]) {
          break;
        }
      }

      // closing code fence must be at least as long as the opening one
      if (Math.floor((pos - start) / marker_len) < marker_count) { continue; }

      // make sure tail has spaces only
      pos -= (pos - start) % marker_len;
      pos = state.skipSpaces(pos);

      if (pos < max) { continue; }

      // found!
      auto_closed = true;
      break;
    }

    old_parent = state.parentType;
    old_line_max = state.lineMax;
    state.parentType = 'timeline';
    state.env.inTimeline = true;

    // this will prevent lazy continuations from ever going past our end marker
    state.lineMax = nextLine;

    token        = state.push('timeline_open', 'div', 1);
    token.markup = markup;
    token.block  = true;
    token.info   = params;
    token.map    = [ startLine, nextLine ];
    token.attrJoin('class', 'timeline')

    token = state.push('timeline_wrapper_open', 'div', 1);
    token.block = true;
    token.attrJoin('class', 'wrapper-timeline');


    state.md.block.tokenize(state, startLine + 1, nextLine);


    token = state.push('timeline_wrapper_close', 'div', -1);
    token.block = true;

    token        = state.push('timeline_close', 'div', -1);
    token.markup = state.src.slice(start, pos);
    token.block  = true;

    state.env.inTimeline = false;
    state.parentType = old_parent;
    state.lineMax = old_line_max;
    state.line = nextLine + (auto_closed ? 1 : 0);

    return true;
  }

  const break_min_markers = 3,
      break_marker_str  = '-',
      break_marker_char = break_marker_str.charCodeAt(0),
      break_marker_len  = break_marker_str.length;

  function timeline_break (state, startLine, endLine, silent) {
    let pos, endPos, marker_count, markup, params, token, title,
        start = state.bMarks[startLine] + state.tShift[startLine],
        max = state.eMarks[startLine];

    // Verify correct parent type. This will filter out all unintended rule invocations.
    //
    if(!state.env.inTimeline) {
      return false;
    }

    // Check out the first character quickly,
    // this should filter out most of non-containers
    //
    if (break_marker_char !== state.src.charCodeAt(start)) { return false; }

    // Check out the rest of the marker string
    //
    for (pos = start + 1; pos <= max; pos++) {
      if (break_marker_str[(pos - start) % break_marker_len] !== state.src[pos]) {
        break;
      }
    }

    marker_count = Math.floor((pos - start) / break_marker_len);
    if (marker_count < break_min_markers) { return false; }
    pos -= (pos - start) % break_marker_len;

    markup = state.src.slice(start, pos);
    params = state.src.slice(pos, max);

    for (endPos = max - 1; endPos >= pos; endPos--) {
      if (break_marker_str !== state.src[endPos]) {
        break
      }
    }
    title = state.src.slice(pos, endPos).trim();

    // Since start is found, we can report success here in validation mode
    //
    if (silent) { return true; }

    token = state.push('timeline_break_start', 'div', 1)
    token.block = true;
    token.markup = markup
    token.info = params
    token.map = [ startLine, startLine + 1 ]
    token.attrJoin('class', 'break')

    token = state.push('timeline_break_label_start', 'span', 1)
    token.attrJoin('class', 'title')

    token = state.push('inline', '', 0)
    token.map = [ startLine, startLine + 1 ]
    token.content = title
    token.children = []

    state.push('timeline_break_label_end', 'span', -1)

    state.push('hr', 'hr', 0)

    token = state.push('timeline_break_end', 'div', -1)
    token.markup = markup
    token.block = true;

    state.line = startLine + 1;

    return true;
  }

  // Search `[:~][\n ]`, returns next pos after marker on success
  // or -1 on fail.
  function skipMarker(state, line) {
    var pos, marker,
        start = state.bMarks[line] + state.tShift[line],
        max = state.eMarks[line];

    if (start >= max) { return -1; }

    // Check bullet
    marker = state.src.charCodeAt(start++);
    if (marker !== 0x7E/* ~ */ && marker !== 0x3A/* : */) { return -1; }

    pos = state.skipSpaces(start);

    // require space after ":"
    if (start === pos) { return -1; }

    // no empty definitions, e.g. "  : "
    if (pos >= max) { return -1; }

    return start;
  }

  class ItemBounds {
    start
    end
    length

    constructor(start, end) {
      this.start = start
      this.end = end
      this.length = end - start
    }
  }

  class YearItem {
    title
    bounds
    state

    constructor(state, bounds) {
      this.bounds = bounds
      this.state = state

      if(bounds) {
        let start = this.state.bMarks[bounds.start] + this.state.tShift[bounds.start];
        let max = this.state.eMarks[bounds.start];

        this.title = this.state.src.slice(start, max).trim();
      } else {
        this.title = ''
      }
    }

    // <div class="year-item">
    //   <span class="year">
    //     title
    //   </span>
    // </div>
    tokenize() {
      let token;

      token = this.state.push('year_item_open', 'div', 1)
      token.attrJoin('class', 'year-item')
      token.block = true
      token.map = [this.bounds.start, this.bounds.end]

      token = this.state.push('year_item_title_open', 'span', 1)
      token.block = true
      token.attrJoin('class', 'year')

      token = this.state.push('inline', '', 0)
      token.map = [this.bounds.start, this.bounds.end]
      token.content = this.title
      token.children = [];

      this.state.push('year_item_title_close', 'span', -1)

      this.state.push('year_item_close', 'div', -1)
    }
  }

  class FullItem {
    title
    label
    body = []
    bounds
    state

    constructor(state, bounds) {
      this.bounds = bounds
      this.state = state

      let lineNo = bounds.start;
      let start = this.state.bMarks[lineNo] + this.state.tShift[lineNo];
      let max = this.state.eMarks[lineNo];

      this.title = this.state.src.slice(start, max).trim();

      lineNo++

      if(bounds.length > 2) {
        start = skipMarker(this.state, lineNo)
        max = this.state.eMarks[lineNo];

        this.label = this.state.src.slice(start, max).trim();

        lineNo++
      }

      for(lineNo; lineNo <= this.bounds.end; lineNo++) {
        if(this.state.isEmpty(lineNo)) { continue; }

        start = skipMarker(this.state, lineNo)
        max = this.state.eMarks[lineNo];

        this.body.push(this.state.src.slice(start, max).trim());
      }
    }

    // <section class="timeline-item">
    //   <div class="item">
    //     <div class="item-date">label</div>
    //     <h3 class="item-title">title</h3>
    //     <p class="item-description">
    //       body[0]
    //     </p>
    //     <p class="item-description">
    //       body[1]
    //     </p>
    //   </div>
    // </section>
    tokenize() {
      let token, bodyIdx,
          lineOffset = this.label ? 2 : 1

      token = this.state.push('full_item_open', 'section', 1)
      token.block = true
      token.map = [ this.bounds.start, this.bounds.end ]
      token.attrJoin('class', 'timeline-item')

      token = this.state.push('full_item_positioner_open', 'div', 1)
      token.block = true
      token.attrJoin('class', 'item')

      // tokenize label if present
      if(this.label) {
        token = this.state.push('label_open', 'div', 1)
        token.map = [ this.bounds.start + lineOffset, this.bounds.start + lineOffset + 1 ]
        token.attrJoin('class', 'item-date')

        token = this.state.push('inline', '', 0)
        token.content = this.label
        token.map = [ this.bounds.start + lineOffset, this.bounds.start + lineOffset + 1 ]
        token.children = []

        this.state.push('label_close', 'div', -1)
      }

      // tokenize title
      token = this.state.push('heading_open', 'h3', 1)
      token.map = [ this.bounds.start, this.bounds.start + 1 ]
      token.attrJoin('class', 'item-title')

      token = this.state.push('inline', '', 0)
      token.content = this.title
      token.map = [ this.bounds.start, this.bounds.start + 1 ]
      token.children = []

      this.state.push('heading_close', 'h3', -1)

      // tokenize each body string
      for(bodyIdx in this.body) {
        token = this.state.push('paragraph_open', 'p', 1)
        token.map = [ this.bounds.start + lineOffset + bodyIdx, this.bounds.end + lineOffset + bodyIdx + 1 ]
        token.attrJoin('class', 'item-description')

        token = this.state.push('inline', '', 0)
        token.content = this.body[bodyIdx]
        token.map = [ this.bounds.start + lineOffset + bodyIdx, this.bounds.end + lineOffset + bodyIdx + 1 ]
        token.children = []

        this.state.push('paragraph_close', 'p', -1)
      }

      this.state.push('full_item_positioner_close', 'div', -1)

      this.state.push('full_item_close', 'section', -1)
    }
  }

  const item_marker_str = ':',
        item_marker_char = item_marker_str.charCodeAt(0);

  function timeline_item (state, startLine, endLine, silent) {
    var pos, nextLine, markup, params, token, itemStart, itemEnd, item, bounds,
        itemBounds = [],
        auto_closed = false,
        start = state.bMarks[startLine] + state.tShift[startLine],
        max = state.eMarks[startLine];

    // Verify correct parent type. This will filter out all unintended rule invocations.
    //
    if(!state.env.inTimeline) {
      return false;
    }

    // Since timeline items consume any text, we can return true immediately in validation mode
    //
    if (silent) { return true; }

    itemStart = startLine

    // consume pairs of timeline item boundaries
    while(itemBounds.length < 2) {
      itemEnd = itemStart + 1;

      // empty or invalid line ends the item
      while (true) {
        if(itemEnd >= endLine) { break; }
        if(state.isEmpty(itemEnd)) { break; }
        if(skipMarker(state, itemEnd) < 0) { break; }
        itemEnd++
      }

      itemBounds.push(new ItemBounds(itemStart, itemEnd))

      // new item might start immediately, but check for multiple empty lines
      itemStart = itemEnd + 1;
      while(state.isEmpty(itemStart)) {
        itemStart++
        if(itemStart >= endLine) { break; }
      }

      // always skip break items
      pos = state.bMarks[itemStart] + state.tShift[itemStart];
      if (state.src.charCodeAt(pos) === break_marker_char) { break; }
    }

    // add wrapper opening token
    token = state.push('timeline_item_wrapper_open', 'div', 1)
    token.attrJoin('class', 'wrapper-item')
    token.block = true

    // parse and tokenize both items
    for (itemIdx in itemBounds) {
      bounds = itemBounds[itemIdx]
      if(bounds.length > 1) {
        item = new FullItem(state, bounds)
      } else {
        item = new YearItem(state, bounds)
      }

      item.tokenize()

      // add a dot separator item after the first real item
      if(itemIdx == 0) {
        // <section class="divider">
        //   <span class="dot"></span>
        // </section>
        token = state.push('timeline_item_dot_open', 'section', 1)
        token.attrJoin('class', 'divider')
        token.block = true

        token = state.push('timeline_item_dot_obj_open', 'span', 1)
        token.attrJoin('class', 'dot')

        state.push('timeline_item_dot_obj_close', 'span', -1)

        state.push('timeline_item_dot_close', 'section', -1)
      }
    }

    // add blank year item if we only have a single item parsed
    if(itemIdx === 0) {
      item = new YearItem(state, null)
      item.tokenize()
    }

    // add wrapper closing token
    token = state.push('timeline_item_wrapper_close', 'div', -1)

    state.line = itemEnd + 1;
    return true;
  }

  md.block.ruler.before('fence', 'timeline_block', timeline, {
    alt: [ 'paragraph', 'reference', 'blockquote', 'list' ]
  })
  md.block.ruler.after('timeline_block', 'timeline_break', timeline_break, {
    alt: [ 'paragraph', 'reference', 'blockquote', 'list' ]
  })
  md.block.ruler.after('timeline_break', 'timeline_item', timeline_item, {
    alt: [ 'paragraph', 'reference', 'blockquote', 'list' ]
  })
}
