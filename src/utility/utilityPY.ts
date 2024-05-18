import type { Range, TextEditor, TextEditorEdit } from 'vscode'
import * as vscode from 'vscode'
import { Base } from './base'
import type { Language } from './index'
import type { Remove } from './type'

export class pyUtility extends Base implements Remove {
  readonly multiLineComments = ["'''", '"""'] as const

  constructor(languageId: Language) {
    super('#', languageId)
  }

  removeComments(editor: TextEditor, edit: TextEditorEdit) {
    // const document = editor.document
    // const endLine = editor.document.lineCount - 1
    const removeRanges: Range[] = []

    let multiLineComment: (typeof this.multiLineComments)[number] | undefined

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
      let { line, trimText, text } = this.textAndLine(document, currentLine)

      if (trimText.length === 0) continue
      if (trimText.startsWith(this.singleLineComment as string)) {
        // 删除单行注释 ￥
        if (trimText[trimText.length - 1] !== this.preserveFlag)
          removeRanges.push(line.rangeIncludingLineBreak)
      } else if ((multiLineComment = this.multiLineComments.find((e) => trimText.startsWith(e)))) {
        // 删除多行注释 ￥
        let startLine = currentLine
        let startCharacter = text.indexOf(multiLineComment)

        let offset = this.getOffset(text, multiLineComment)
        text = text.slice(offset)
        while (text.indexOf(multiLineComment) === -1) {
          currentLine++
          ;({ text } = this.textAndLine(document, currentLine))
        }

        if (startLine !== currentLine) {
          offset = this.getOffset(text, multiLineComment)
        } else {
          offset += this.getOffset(text, multiLineComment)
        }

        removeRanges.push(new vscode.Range(startLine, startCharacter, currentLine, offset))
      }
    }

    removeRanges.forEach((e) => {
      edit.delete(e)
    })
  }

  private getOffset(text: string, mc: string) {
    return text.indexOf(mc) + mc.length
  }
}
