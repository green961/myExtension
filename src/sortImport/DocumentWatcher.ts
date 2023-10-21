import { Disposable, workspace } from 'vscode'
import { TextDocument, TextDocumentSaveReason } from 'vscode'
import { PreSaveTransformation } from './PreSaveTransformation'
import { SetEndOfLine } from './SetEndOfLine'

export default class DocumentWatcher {
  private disposable: Disposable
  private preSaveTransformations: PreSaveTransformation[] = [new SetEndOfLine()]

  public constructor() {
    const subscriptions: Disposable[] = []

    subscriptions.push(
      workspace.onWillSaveTextDocument(async (e) => {
        if (e.document.languageId !== 'typescript') {
          return
        }

        const transformations = this.calculatePreSaveTransformations(e.document, e.reason)
        console.log('workspace.onWillSaveTextDocument 3')
        e.waitUntil(transformations)
      })
    )

    this.disposable = Disposable.from.apply(this, subscriptions)
  }

  private async calculatePreSaveTransformations(doc: TextDocument, reason: TextDocumentSaveReason) {
    return [
      ...this.preSaveTransformations.flatMap((transformer) => {
        const { edits } = transformer.transform(doc, reason)
        return edits
      }),
    ]
  }

  public dispose() {
    this.disposable.dispose()
  }
}
