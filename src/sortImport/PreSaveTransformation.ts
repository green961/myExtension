// import { KnownProps } from 'editorconfig'
import { TextDocument, TextDocumentSaveReason, TextEdit } from 'vscode'

export abstract class PreSaveTransformation {
  public abstract transform(
    doc?: TextDocument,
    reason?: TextDocumentSaveReason
  ): {
    edits: TextEdit[]
    message?: string
  }
}
