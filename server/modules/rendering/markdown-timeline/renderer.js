const mdTimeline = require('./timeline')

// ------------------------------------
// Markdown - Definition Lists
// ------------------------------------

module.exports = {
  init (md, conf) {
    md.use(mdTimeline)
  }
}
