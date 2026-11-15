import { HighlightStyle, StreamLanguage, type StringStream } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { parseChord } from 'markdown-it-markflat'

// markflat highlighting for the editor (B13): the heading, verse numbers, ~labels, chords
// (a brace that is no chord is a mark and looks quieter, so a chord typo stands out), wide
// spaces and _emphasis_.

interface State {
  lineStart: boolean
}

export const markflatLanguage = StreamLanguage.define<State>({
  name: 'markflat',
  startState: () => ({ lineStart: true }),
  token(stream: StringStream, state: State) {
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
    stream.next()
    stream.eatWhile(/[^{=_\n]/)
    return null
  },
  tokenTable: { labelName: tags.labelName },
})

export const markflatHighlight = HighlightStyle.define([
  { tag: tags.heading, fontWeight: '700', color: 'var(--text)' },
  { tag: tags.keyword, color: 'var(--accent)', fontWeight: '600' },
  { tag: tags.meta, color: 'var(--muted)' },
  { tag: tags.labelName, color: 'var(--accent-strong)', fontStyle: 'italic' },
  { tag: tags.number, color: 'var(--muted)', fontWeight: '600' },
  { tag: tags.operator, color: 'var(--muted)', backgroundColor: 'var(--surface-2)' },
  { tag: tags.emphasis, textDecoration: 'underline' },
])
