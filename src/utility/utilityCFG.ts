import { Base } from './base'
import type { Range, TextEditor, TextEditorEdit } from 'vscode'
import type { Remove } from './type'
import type { Language } from './index'

export class cfgUtility extends Base implements Remove {
  // singleLineComment:string
  // constructor() {
  //   super(';','cfg')
  // }
  constructor(languageId: Language) {
    super(';', languageId)
  }

  removeComments(editor: TextEditor, edit: TextEditorEdit) {
    const document = editor.document
    const endLine = editor.document.lineCount - 1
    const removeRanges: Range[] = []

    for (let lineNr = 0; lineNr <= endLine; lineNr++) {
      let { line, trimText } = this.textAndLine(document, lineNr)

      if (trimText.length === 0) continue
      if (trimText.startsWith(this.singleLineComment as string)) {
        if (trimText[trimText.length - 1] !== this.preserveFlag)
          removeRanges.push(line.rangeIncludingLineBreak)
      }
    }

    removeRanges.forEach((e) => {
      edit.delete(e)
    })
  }
}
