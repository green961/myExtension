import { Base } from './base'
import type { Range, TextEditor, TextEditorEdit } from 'vscode'
import type { Remove } from './type'

export class shUtility extends Base implements Remove {
  constructor() {
    super('#', 'shellscript')
  }

  removeComments(editor: TextEditor, edit: TextEditorEdit) {
    const document = editor.document
    // const endLine = editor.document.lineCount - 1
    const removeRanges: Range[] = []

    const { selection, selections } = editor

    let startLine: number
    let endLine: number
    if (selections.length > 2) return
    if (selections.length > 1) {
      ;[startLine, endLine] = [selections[0].active.line, selections[1].active.line].sort((a, b) => a - b)
    } else {
      ;[startLine, endLine] = [selection.start.line, selection.end.line]
    }
    if (startLine === endLine || (startLine === 0 && endLine === editor.document.lineCount - 1)) return

    if (startLine === 0) {
      let trimText = ''
      do {
        ;({ trimText } = this.textAndLine(document, startLine))
      } while (trimText.length === 0 && ++startLine)
      ;/^#!\//.test(trimText) && ++startLine
    }

    for (let currentLine = startLine; currentLine <= endLine; currentLine++) {
      let { line, trimText } = this.textAndLine(document, currentLine)

      if (trimText.length === 0) continue
      if (trimText.startsWith(this.singleLineComment as string)) {
        if (trimText[trimText.length - 1] !== this.preserveFlag) removeRanges.push(line.rangeIncludingLineBreak)
      }
    }

    removeRanges.forEach((e) => {
      edit.delete(e)
    })
  }
}
