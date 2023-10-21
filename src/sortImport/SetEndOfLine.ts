import { TextDocument, TextEdit } from 'vscode'

import { PreSaveTransformation } from './PreSaveTransformation'

export class SetEndOfLine extends PreSaveTransformation {
  public transform(doc: TextDocument) {
    let cc = doc.lineAt(0)
    let aa = cc.text

    return {
      edits: [TextEdit.replace(cc.range, aa)],
    }
  }
}
