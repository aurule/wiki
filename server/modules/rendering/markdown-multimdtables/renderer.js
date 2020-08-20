const mmdTable = require('markdown-it-multimd-table')

// ------------------------------------
// Markdown - MultiMarkdown Tables
// ------------------------------------

module.exports = {
  init (md, conf) {
    md.use(mmdTable, {
      multiline: conf.multiline,
      rowspan: conf.rowspan,
      headerless: conf.headerless
    })
  }
}
