import { Base } from './base'
import type { Range, TextEditor, TextEditorEdit } from 'vscode'
import type { Remove } from './type'
import type { Language } from './index'

export class htmlUtility extends Base implements Remove {
  constructor(languageId: Language) {
    super('<!--', languageId)
  }

  removeComments(editor: TextEditor, edit: TextEditorEdit) {
    const removeRanges: Range[] = []
    const { selection, selections, document } = editor

    let startLine: number
    let endLine: number
    if (selections.length > 2) return
    if (selections.length > 1) {
      ;[startLine, endLine] = [selections[0].active.line, selections[1].active.line].sort((a, b) => a - b)
    } else {
      ;[startLine, endLine] = [selection.start.line, selection.end.line]
    }
    if (startLine === endLine) return

    for (let currentLine = startLine; currentLine <= endLine; currentLine++) {
      let { line, trimText } = this.textAndLine(document, currentLine)
      if (trimText.length === 0) continue
      if (trimText.startsWith(this.singleLineComment as string)) {
        while (trimText.slice(-3) !== '-->') {
          removeRanges.push(line.rangeIncludingLineBreak)
          ;({ trimText, line } = this.textAndLine(document, ++currentLine))
        }
        removeRanges.push(line.rangeIncludingLineBreak)
      }
    }

    removeRanges.forEach((e) => {
      edit.delete(e)
    })
  }
}
