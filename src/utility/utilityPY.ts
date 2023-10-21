import { Base } from './base'
import * as vscode from 'vscode'
import type { Range, TextEditor, TextEditorEdit } from 'vscode'
import type { Remove } from './type'
import type { Language } from './index'

export class pyUtility extends Base implements Remove {
  readonly multiLineComments = ["'''", '"""'] as const

  constructor(languageId: Language) {
    super('#', languageId)
  }

  removeComments(editor: TextEditor, edit: TextEditorEdit) {
    const document = editor.document
    const endLine = editor.document.lineCount - 1
    const removeRanges: Range[] = []

    let multiLineComment: (typeof this.multiLineComments)[number] | undefined

    for (let lineNr = 0; lineNr <= endLine; lineNr++) {
      let { line, trimText, text } = this.textAndLine(document, lineNr)

      if (trimText.length === 0) continue
      if (trimText.startsWith(this.singleLineComment as string)) {
        // 删除单行注释 ￥
        if (trimText[trimText.length - 1] !== this.preserveFlag) removeRanges.push(line.rangeIncludingLineBreak)
      } else if ((multiLineComment = this.multiLineComments.find((e) => trimText.startsWith(e)))) {
        // 删除多行注释 ￥
        let startLine = lineNr
        let startCharacter = text.indexOf(multiLineComment)

        let offset = this.getOffset(text, multiLineComment)
        text = text.slice(offset)
        while (text.indexOf(multiLineComment) === -1) {
          lineNr++
          ;({ text } = this.textAndLine(document, lineNr))
        }

        if (startLine !== lineNr) {
          offset = this.getOffset(text, multiLineComment)
        } else {
          offset += this.getOffset(text, multiLineComment)
        }

        removeRanges.push(new vscode.Range(startLine, startCharacter, lineNr, offset))
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
