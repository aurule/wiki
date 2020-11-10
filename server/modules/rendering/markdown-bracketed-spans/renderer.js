const mdBracketSpan = require('markdown-it-bracketed-spans')

// ------------------------------------
// Markdown - Abbreviations
// ------------------------------------

module.exports = {
  init (md, conf) {
    md.use(mdBracketSpan)
  }
}
