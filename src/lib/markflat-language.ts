import { HighlightStyle, StreamLanguage, type StringStream } from '@codemirror/language'
import { Tag, tags } from '@lezer/highlight'

/** *italic*, apart from _emphasis_ (underlined) */
const italic = Tag.define()
import { parseChord } from 'markdown-it-markflat'

// markflat highlighting for the editor (B13): the heading, verse numbers, ~labels, chords
// (a brace that is no chord is a mark and looks quieter, so a chord typo stands out), wide
// spaces, _emphasis_, *italic* and **bold**; the front matter (`---` … `---` at the very top)
// quietly, as a comment.

interface State {
  lineStart: boolean
  /** the front matter: may start (first line), inside it, or past it */
  front: 'start' | 'in' | 'done'
}

export const markflatLanguage = StreamLanguage.define<State>({
  name: 'markflat',
  startState: () => ({ lineStart: true, front: 'start' }),
  copyState: s => ({ ...s }),
  blankLine(state: State) {
    if (state.front === 'start') state.front = 'done'
  },
  token(stream: StringStream, state: State) {
    const fence = stream.sol() && stream.string.trimEnd() === '---'
    if (state.front === 'start') {
      state.front = fence ? 'in' : 'done'
      if (fence) {
        stream.skipToEnd()
        return 'comment'
      }
    } else if (state.front === 'in') {
      if (fence) state.front = 'done'
      stream.skipToEnd()
      return 'comment'
    }
    if (stream.sol()) state.lineStart = true
    if (state.lineStart) {
      if (stream.eatSpace()) return null
      state.lineStart = false
      if (stream.match(/^#\s.*/)) return 'heading'
      if (stream.match(/^\d+\.(?=\s|$)/)) {
        state.lineStart = true // a ~label may follow the number
        return 'number'
      }
      if (stream.match(/^~\S*/)) return 'labelName'
    }
    const brace = stream.match(/^\{([^}\n]*)\}/) as RegExpMatchArray | null
    if (brace) return parseChord(brace[1]) ? 'keyword' : 'meta'
    if (stream.match('==')) return 'operator'
    if (stream.match(/^_[^_\n]+_/)) return 'emphasis'
    if (stream.match(/^\*\*[^*\n]+\*\*/)) return 'strong'
    if (stream.match(/^\*[^*\n]+\*/)) return 'italic'
    stream.next()
    stream.eatWhile(/[^{=_*\n]/)
    return null
  },
  tokenTable: { labelName: tags.labelName, italic },
})

export const markflatHighlight = HighlightStyle.define([
  { tag: tags.heading, fontWeight: '700', color: 'var(--text)' },
  { tag: tags.keyword, color: 'var(--accent)', fontWeight: '600' },
  { tag: tags.meta, color: 'var(--muted)' },
  { tag: tags.comment, color: 'var(--muted)', fontStyle: 'italic' },
  { tag: tags.labelName, color: 'var(--accent-strong)', fontStyle: 'italic' },
  { tag: tags.number, color: 'var(--muted)', fontWeight: '600' },
  { tag: tags.operator, color: 'var(--muted)', backgroundColor: 'var(--surface-2)' },
  { tag: tags.emphasis, textDecoration: 'underline' },
  { tag: italic, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: '700' },
])
