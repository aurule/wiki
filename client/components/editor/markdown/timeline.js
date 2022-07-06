// ------------------------------------
// Markdown - Timeline Preprocessor
// ------------------------------------

module.exports = function timelinePlugin(md, options) {
  const isSpace = md.utils.isSpace

  ///////////////////
  // Fence Handler
  ///////////////////

  // since we share our fence syntax with the markdown container plugin, we need to ignore all blocks except
  // those marked as a timeline
  function validateDefault(params, markup) {
    return params.trim().split(' ', 2)[0] === 'timeline'
  }

  options = options || {};
  const min_markers = 3,
      marker_str  = options.marker || ':',
      marker_char = marker_str.charCodeAt(0),
      marker_len  = marker_str.length,
      validate    = options.validate || validateDefault;

  /**
   * Parse for timeline fences
   *
   * Matches the syntax:
   *
   * ::: timeline
   *
   * :::
   *
   * Once matched, it sets the inTimeline flag on state.env to true, allowing the other timeline rules to
   * execute during its call to state.md.block.tokenize(). Afterward, it sets the flag to false.
   *
   * @param  {State} state    Markdown-it State object
   * @param  {int} startLine  Index of initial line
   * @param  {int} endLine    Index of last valid line
   * @param  {bool} silent    True if in validation mode
   * @return {bool}           True if a timeline fence was matched, false if not
   */
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
    token.map    = [ startLine, startLine + 1 ];
    token.attrJoin('class', 'timeline')

    token = state.push('timeline_wrapper_open', 'div', 1);
    token.block = true;
    token.attrJoin('class', 'wrapper-timeline');


    state.md.block.tokenize(state, startLine + 1, nextLine);


    token = state.push('timeline_wrapper_close', 'div', -1);
    token.block = true;

    token        = state.push('timeline_close', 'div', -1);
    token.markup = state.src.slice(start, pos);
    token.map    = [ nextLine, nextLine + 1 ];
    token.block  = true;

    state.env.inTimeline = false;
    state.parentType = old_parent;
    state.lineMax = old_line_max;
    state.line = nextLine + (auto_closed ? 1 : 0);

    return true;
  }

  ///////////////////
  // Break Handler
  ///////////////////

  const break_min_markers = 3,
      break_marker_str  = '-',
      break_marker_char = break_marker_str.charCodeAt(0),
      break_marker_len  = break_marker_str.length;

  /**
   * Parse for timeline breaks
   *
   * Matches the syntax:
   *
   * --- title ---
   *
   * The trailing dashes are optional.
   *
   * @param  {State} state    Markdown-it State object
   * @param  {int} startLine  Index of initial line
   * @param  {int} endLine    Index of last valid line
   * @param  {bool} silent    True if in validation mode
   * @return {bool}           True if a timeline break was matched, false if not
   */
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
    title = state.src.slice(pos, endPos + 1).trim();

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

  ///////////////////
  // Item Handling
  ///////////////////

  /**
   * Search for item detail marker
   *
   * Validations:
   * - leading character is present
   * - space appears after leading character
   * - more characters appear after leading char and space
   *
   * Ex:
   *
   * : test
   * > 2
   *
   * :test
   * > -1
   *
   * :
   * > -1
   *
   * test
   * > -1
   *
   * @param  {State} state Markdown-it state object
   * @param  {int}   line  Line index to search
   * @return {int}         Next character position after the marker on success, or -1 on fail
   */
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

  /**
   * Simple bounds class to track start, end, and length of an item
   */
  class ItemBounds {
    start
    end
    length

    /**
     * Create an ItemBounds object
     *
     * @param  {int} start Index of the starting line
     * @param  {int} end   Index of the ending line
     */
    constructor(start, end) {
      this.start = start
      this.end = end
      this.length = end - start
    }
  }

  /**
   * Year item parsing and tokenization
   */
  class YearItem {
    title
    bounds
    state

    /**
     * Create a YearItem object
     *
     * The text of the first line in bounds is stored as the year's title. If no bounds are given, an empty
     * string is used instead.
     *
     * @param  {State}           state  Markdown-it State object
     * @param  {ItemBounds|null} bounds Boundary object for the extent of this item
     */
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

    /**
     * Create tokens for this year item
     *
     * <div class="year-item">
     *   <span class="year">
     *     title
     *   </span>
     * </div>
     *
     * @return {void} No return value
     */
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

  /**
   * Full item parsing and tokenization
   */
  class FullItem {
    title
    label
    body = []
    bounds
    state

    /**
     * Create a FullItem object
     *
     * The first line in bounds is always the item's title. If there is only one remaining line, it becomes
     * the item's only body line. Otherwise, the second line becomes the item's label and all remaining lines
     * are added to the body.
     *
     * ex:
     *
     * title
     * : body
     *
     * title
     * : label
     * : body 1
     * : body 2
     *
     * @param  {State}      state  Markdown-it State object
     * @param  {ItemBounds} bounds Boundary object for the extent of this item
     */
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

    /**
     * Create tokens for this full item
     *
     * <section class="timeline-item">
     *   <div class="item-date">label</div>
     *   <h3>title</h3>
     *   <p>
     *     body[0]
     *   </p>
     *   <p>
     *     body[1]
     *   </p>
     * </section>
     *
     *
     * @return {void} No return value
     */
    tokenize() {
      let token, bodyIdx,
          lineOffset = this.label ? 2 : 1

      token = this.state.push('full_item_open', 'section', 1)
      token.block = true
      token.map = [ this.bounds.start, this.bounds.end ]
      token.attrJoin('class', 'timeline-item')

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

      token = this.state.push('inline', '', 0)
      token.content = this.title
      token.map = [ this.bounds.start, this.bounds.start + 1 ]
      token.children = []

      this.state.push('heading_close', 'h3', -1)

      // tokenize each body string
      for(bodyIdx in this.body) {
        token = this.state.push('paragraph_open', 'p', 1)
        token.map = [ this.bounds.start + lineOffset + bodyIdx, this.bounds.end + lineOffset + bodyIdx + 1 ]

        token = this.state.push('inline', '', 0)
        token.content = this.body[bodyIdx]
        token.map = [ this.bounds.start + lineOffset + bodyIdx, this.bounds.end + lineOffset + bodyIdx + 1 ]
        token.children = []

        this.state.push('paragraph_close', 'p', -1)
      }

      this.state.push('full_item_close', 'section', -1)
    }
  }

  const item_marker_str = ':',
        item_marker_char = item_marker_str.charCodeAt(0);

  /**
   * Parse for timeline items
   *
   * Items on one line become year items, while items with one or more detail lines become full items:
   *
   * I'm a year item!
   *
   * I'm a full item!
   * : Because I have a description
   *
   * @param  {State} state    Markdown-it State object
   * @param  {int} startLine  Index of initial line
   * @param  {int} endLine    Index of last valid line
   * @param  {bool} silent    True if in validation mode
   * @return {bool}           True if a timeline item was matched, false if not
   */
  function timeline_item (state, startLine, endLine, silent) {
    var pos, nextLine, markup, params, token, itemStart, itemEnd, item, bounds,
        itemBounds = [],
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
      if(itemStart >= endLine) { break; }
      while(state.isEmpty(itemStart)) {
        itemStart++
        if(itemStart >= endLine) { break; }
      }

      // always skip break items
      pos = state.bMarks[itemStart] + state.tShift[itemStart];
      if (state.src.charCodeAt(pos) === break_marker_char) { break; }
      if (state.src.charCodeAt(pos) === marker_char) { break; }
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

  ///////////////////
  // Add Rules
  ///////////////////

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
