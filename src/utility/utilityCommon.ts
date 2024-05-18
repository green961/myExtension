import type { Range, TextEditor, TextEditorEdit } from 'vscode'
import * as vscode from 'vscode'
import { getInstance } from '../extension'
import { Base, determineLang } from './base'
import type { Language } from './index'
import type { Remove } from './type'

export class commonUtility extends Base implements Remove {
  readonly multiLineComments = ['/*', '*/']

  constructor(languageId: Language) {
    super('//', languageId)
  }

  removeComments(editor: TextEditor, edit: TextEditorEdit) {
    if (this.languageId === 'html' || this.languageId === 'markdown') {
      return
    }

    const removeRanges: Range[] = []
    const { selection, selections, document } = editor

    const lineIndex = selection.active.line
    const lang = determineLang(this.languageId, document, lineIndex)
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
    if (startLine === 0 && this.languageId === 'dockerfile') {
      startLine++
    }

    const mulComments = (currentLine: number, text: string) => {
      let start: [number, number] = [currentLine, text.indexOf(this.multiLineComments[0])]

      let multiLineCommentsOfEnd = this.multiLineComments[1]

      while (text.indexOf(multiLineCommentsOfEnd) === -1) {
        currentLine++
        ;({ text } = this.textAndLine(document, currentLine))
      }

      let offset = text.indexOf(multiLineCommentsOfEnd) + multiLineCommentsOfEnd.length
      removeRanges.push(new vscode.Range(...start, currentLine, offset))
      return currentLine
    }

    for (let currentLine = startLine; currentLine <= endLine; currentLine++) {
      let { line, trimText, text } = this.textAndLine(document, currentLine)
      if (trimText.length === 0) continue
      if (trimText.startsWith(this.singleLineComment)) {
        if (trimText[trimText.length - 1] !== this.preserveFlag)
          removeRanges.push(line.rangeIncludingLineBreak)
      } else if (trimText.startsWith(this.multiLineComments[0])) {
        currentLine = mulComments(currentLine, text)
      }
    }

    removeRanges.forEach((e) => {
      edit.delete(e)
    })

    editor.selection = new vscode.Selection(selection.active, selection.active)
    if (selection.start.line === 0 && selection.end.line === document.lineCount - 1) {
      vscode.commands.executeCommand('workbench.action.files.save')
    }
  }
}
