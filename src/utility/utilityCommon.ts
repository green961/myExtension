import { getInstance } from '../extension'
import { checkVue } from './base'
import { Base } from './base'
import * as vscode from 'vscode'
import type { TextEditor, TextEditorEdit, Range } from 'vscode'
import type { Remove } from './type'
import type { Language } from './index'

export class commonUtility extends Base implements Remove {
  readonly multiLineComments = ['/*', '*/']

  constructor(languageId: Language) {
    super('//', languageId)
  }

  removeComments(editor: TextEditor, edit: TextEditorEdit) {
    if (this.languageId === 'html' || this.languageId === 'markdown') {
      return
    }

    // const document = editor.document
    const removeRanges: Range[] = []
    const { selection, selections, document } = editor

    const lineIndex = selection.active.line
    const lang = checkVue(this.languageId, document, lineIndex)
    if (lang === 'html') {
      getInstance(lang)?.removeComments(editor, edit)
      return
    }

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
      let { line, trimText, text } = this.textAndLine(document, currentLine)
      if (trimText.length === 0) continue
      if (trimText.startsWith(this.singleLineComment as string)) {
        if (trimText[trimText.length - 1] !== this.preserveFlag)
          removeRanges.push(line.rangeIncludingLineBreak)
      } else if (trimText.startsWith(this.multiLineComments[0])) {
        let start: [number, number] = [currentLine, text.indexOf(this.multiLineComments[0])]

        let multiLineCommentsOfEnd = this.multiLineComments[1]

        while (text.indexOf(multiLineCommentsOfEnd) === -1) {
          currentLine++
          ;({ text } = this.textAndLine(document, currentLine))
        }

        let offset = text.indexOf(multiLineCommentsOfEnd) + multiLineCommentsOfEnd.length
        removeRanges.push(new vscode.Range(...start, currentLine, offset))
      }
    }

    removeRanges.forEach((e) => {
      edit.delete(e)
    })
  }
}
