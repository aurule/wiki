const mdDefList = require('markdown-it-deflist')

// ------------------------------------
// Markdown - Definition Lists
// ------------------------------------

module.exports = {
  init (md, conf) {
    md.use(mdDefList)
  }
}
