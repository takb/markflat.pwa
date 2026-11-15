<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { EditorState } from '@codemirror/state'
import { drawSelection, EditorView, highlightSpecialChars, keymap } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search'
import { syntaxHighlighting } from '@codemirror/language'
import { markflatHighlight, markflatLanguage } from '@/lib/markflat-language'

// The song text editor (B13): CodeMirror 6 with markflat highlighting, undo/redo, search
// (Ctrl+F), line wrapping. The font size follows the app's zoom.
const model = defineModel<string>({ required: true })
defineProps<{ fontSize: number }>()
const emit = defineEmits<{ save: [] }>()
const host = ref<HTMLElement>()
let view: EditorView | undefined

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: 'inherit', backgroundColor: 'var(--bg)', color: 'var(--text)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', lineHeight: '1.6' },
  '.cm-content': { padding: '0.75rem 0', caretColor: 'var(--text)' },
  '.cm-line': { padding: '0 0.75rem' },
  '.cm-cursor': { borderLeftColor: 'var(--text)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'var(--accent-soft) !important' },
  '.cm-selectionMatch': { backgroundColor: 'var(--surface-2)' },
  '.cm-searchMatch': { backgroundColor: 'var(--surface-2)', outline: '1px solid var(--border)' },
  '.cm-searchMatch-selected': { backgroundColor: 'var(--accent-soft)' },
  '.cm-panels': { backgroundColor: 'var(--surface)', color: 'var(--text)', borderColor: 'var(--border)' },
  '.cm-panel.cm-search': { fontSize: '0.875rem', padding: '0.5rem' },
  '.cm-panel.cm-search input, .cm-panel.cm-search button': { fontSize: '0.875rem' },
  '.cm-textfield': { backgroundColor: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '0.375rem' },
  '.cm-button': { backgroundImage: 'none', backgroundColor: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '0.375rem' },
})

onMounted(() => {
  view = new EditorView({
    parent: host.value,
    state: EditorState.create({
      doc: model.value,
      extensions: [
        history(),
        drawSelection(),
        highlightSpecialChars(),
        highlightSelectionMatches(),
        search({ top: true }),
        EditorView.lineWrapping,
        markflatLanguage,
        syntaxHighlighting(markflatHighlight),
        theme,
        keymap.of([{ key: 'Mod-s', preventDefault: true, run: () => { emit('save'); return true } }, ...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        EditorView.contentAttributes.of({ 'aria-label': 'Song text', spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off' }),
        EditorView.updateListener.of(u => {
          if (u.docChanged) model.value = u.state.doc.toString()
        }),
      ],
    }),
  })
})

// A change from outside (undo all changes, a conflict settled): the editor shows it.
watch(model, text => {
  if (view && text !== view.state.doc.toString()) {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } })
  }
})

onBeforeUnmount(() => view?.destroy())
</script>

<template>
  <div ref="host" class="h-full min-h-0" :style="{ fontSize: fontSize * 0.95 + 'rem' }" />
</template>
