import type { TextEditor, TextEditorEdit } from 'vscode'

export interface Remove {
  removeComments(editor: TextEditor, edit: TextEditorEdit): void
}
// ssh user@hostname

// 9j7stKGNl4Qw5X1Cf8
// ssh root@47.87.137.225
// “cat id_rsa.pub >> authorized_keys”
// chmod 600 ~/.ssh/authorized_keys
// mkdir ~/.ssh
