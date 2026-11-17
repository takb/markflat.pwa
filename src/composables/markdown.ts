import MarkdownIt from 'markdown-it'
import markflat from 'markdown-it-markflat'
import 'markdown-it-markflat/markflat.css'

// The song renderer. No raw HTML from song text; the typographer turns "..." into "…" (as the
// old renderer did) but leaves quotes alone. Per-view options go in the environment:
// md.render(text, { transpose, unicode, detailed, jazz }).
export const md = new MarkdownIt({ html: false, typographer: true })
  .disable('smartquotes')
  .use(markflat, { unicode: true })
