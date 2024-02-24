import { activate } from './cc'
import * as vscode from 'vscode'

export function fuck(ctx: vscode.ExtensionContext) {
  console.log('fuck')
  activate(ctx)
}
