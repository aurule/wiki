const mdMark = require('markdown-it-mark')

// ------------------------------------
// Markdown - Definition Lists
// ------------------------------------

module.exports = {
  init (md, conf) {
    md.use(mdMark)
  }
}
