import { StatusBarItem, window, workspace } from 'vscode'

export const enum AutoSave {
  onFocusChange = 'onFocusChange',
  onWindowChange = 'onWindowChange',
  off = 'off',
}
export type AutoSaveStrings = keyof typeof AutoSave

export class StatusBar {
  private statusBarItem: StatusBarItem

  constructor() {
    this.statusBarItem = window.createStatusBarItem()
    this.setText()
    this.show()

    workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('files.autoSave')) {
        this.setText()
      }
    })
  }

  private show() {
    this.statusBarItem.show()
  }

  get current(): AutoSaveStrings {
    return workspace.getConfiguration('files').get<AutoSaveStrings>('autoSave', 'off')
  }

  setText() {
    this.statusBarItem.text = this.current !== 'off' ? this.current : `autoSave $(close)`
  }
}
