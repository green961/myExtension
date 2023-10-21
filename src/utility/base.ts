import * as vscode from 'vscode'
import type { TextDocument, TextEditor, TextEditorEdit } from 'vscode'
import type { Language } from './index'

export const lineEndings = {
  CRLF: '\r\n',
  LF: '\n',
}

function singleLineComment() {
  return ['<!-- ', ' -->']
}

export const checkVue = (instance: Language, document, startLine) => {
  if (instance === 'vue') {
    let scriptEndLine: number

    for (let i = 0; i < document.lineCount; i++) {
      const { text } = document.lineAt(i)
      if (/^\s*<\/script/.test(text)) {
        scriptEndLine = i
        break
      }
    }
    if (startLine > scriptEndLine!) {
      return 'html'
    } else {
      return 'typescript'
    }
  }
}

export class Base {
  readonly preserveFlag = '￥'
  readonly singCommRE = new RegExp(String.raw`(?<=^\s*)(?:${this.singleLineComment}\s*)`)
  startDetection?: RegExp
  declareVariableKeywords = ['var']
  public embeddedLanguage: Language

  constructor(public singleLineComment: string, readonly languageId: Language) {
    this.embeddedLanguage = languageId

    if (languageId === 'javascript') {
      this.declareVariableKeywords = ['let', 'const']
      this.startDetection = new RegExp(String.raw`${this.singleLineComment}\s*@ts-check`)
    } else if (languageId === 'typescript') {
      this.startDetection = new RegExp(String.raw`${this.singleLineComment}\s*@ts-nocheck`)
      this.declareVariableKeywords = ['let', 'const', 'type']
    } else if (languageId === 'vue') {
      this.declareVariableKeywords = ['let', 'const', 'type']
    }
  }

  addComments(text: string, lang: Language = this.languageId!) {
    let [, intendent, str] = /^(\s*)(.*)/.exec(text)!
    if (lang === 'html') {
      let [start, end] = singleLineComment()
      return `${intendent}${start}${str}${end}`
    }
    return `${intendent}${this.singleLineComment} ${str}`
  }

  ctrlAltp(editor: TextEditor, edit: TextEditorEdit) {
    const { document, selections } = editor
    if (selections.length !== 2) {
      return
    }

    let functionRe = /^\s*static\s+([a-z]+)\s+([a-z]+)\s*\((.*)\)/i
    if (selections.some((s) => functionRe.test(document.lineAt(s.active.line).text))) {
      let [isEmpty, notEmpty] = [...selections].sort((s) => {
        // const { text } = this.textAndLine(document, a.active.line)
        const { text } = document.lineAt(s.active.line)
        return functionRe.test(text) ? 1 : -1
      })

      let { trimText: variableName, line } = this.textAndLine(document, isEmpty.active.line)
      variableName = /(?:var\s+)?(.*)/.exec(variableName)![1] || 'awesome'
      const { text } = this.textAndLine(document, notEmpty.active.line)
      let [, returnType, fnName, param] = functionRe.exec(text)!
      param = param.split(' ')[0]

      let value: string
      if (returnType === 'void') {
        value = `Action<${param}> ${variableName} = ${fnName};`
      } else {
        value = `Func<${param}, ${returnType}> ${variableName} = ${fnName};`
      }

      edit.replace(line.range, value)
      editor.selection = new vscode.Selection(isEmpty.active, isEmpty.active)
    }
  }

  ctrlPlusy(editor: TextEditor, edit: TextEditorEdit) {
    const { document, selections, selection } = editor

    if (selections.length === 2) {
      let [t0, t1] = selections.map((selection) => document.getText(selection))

      if (t0 || t1) {
        if (t0 && t1) {
          // 两个选中内容之间的交换
          // let currentSelection = t0.length > t1.length ? selections[0] : selections[1]

          let values = [t1, t0]
          selections.forEach((selection, i) => {
            edit.replace(selection, values[i])
          })
          // editor.selection = new vscode.Selection(currentSelection.end, currentSelection.end)
          // editor.selection = new vscode.Selection(selection.active, selection.active)
          editor.selection = new vscode.Selection(selection.end, selection.end)
        } else {
          // 复制选中内容到指定位置
          let { isEmpty, notEmpty } = this.emptyAndNotEmpty(document, selections)
          let value = document.getText(notEmpty)

          // vscode.commands.executeCommand('editor.action.clipboardCopyAction')
          if (!value.includes('\n')) {
            vscode.env.clipboard.writeText(value.trim())
          }

          // const darwinPlatforms=new Set<DownloadPlatform>(['
          // /^[0-9]+\.[0-9]+\.[0-9]$/.test(version)
          edit.insert(isEmpty.active, value)
          editor.selection = new vscode.Selection(isEmpty.active, isEmpty.active)
        }
      } else {
        // 两行之间交换, 如果有一行为空行则把 position 放在有内容的一行
        let position = selection.active

        let arr = selections.map((e) => {
          const currentLine = document.lineAt(e.active.line)

          if (!currentLine.text.trim()) {
            position = e.active
          }
          return currentLine
        })

        edit.replace(arr[0].range, arr[1].text)
        edit.replace(arr[1].range, arr[0].text)
        editor.selection = new vscode.Selection(position, position)
      }
    } else {
      const selection = editor.selection
      let lineIndex = selection.active.line
      let { text, line } = this.textAndLine(editor.document, lineIndex)

      // 删除当前行内容，保留缩进 ￥
      const spaces = text.match(/^(?:\s*)/)![0]
      edit.replace(line.range, spaces)
      editor.selection = new vscode.Selection(lineIndex, spaces.length, lineIndex, spaces.length)
    }
  }

  ctrlPlusg(editor: TextEditor) {
    const { document: doc, selection } = editor
    const lineIndex = selection.active.line

    const { text } = this.textAndLine(doc, lineIndex)
    if (selection.active.character !== text.length) {
      editor.selection = new vscode.Selection(lineIndex, text.length, lineIndex, text.length)
    }
    // 再按一次回到行首, 鸡肋
    // else {
    //   let first = line.firstNonWhitespaceCharacterIndex
    //   editor.selection = new vscode.Selection(lineIndex, first, lineIndex, first)
    // }
  }

  async ctrlPlusn(editor: TextEditor, edit: TextEditorEdit) {
    const { document, selection, selections } = editor
    const startLine = selection.start.line
    let end_of_line = lineEndings[vscode.EndOfLine[document.eol]]

    if (selections.length === 1) {
      if (selection.isEmpty) {
        // 单行，先备份再修改
        let { text: currentLineText, isEmptyOrWhitespace } = document.lineAt(startLine)
        if (isEmptyOrWhitespace) {
          return
        }

        edit.insert(
          new vscode.Position(startLine, 0),
          `${this.addComments(
            currentLineText,
            checkVue(this.languageId, document, startLine)
          )}${end_of_line}`
        )
      } else if (startLine !== selection.end.line) {
        // 多行，先备份再修改

        // let lang: Language = this.languageId!
        if (this.languageId === 'html' || checkVue(this.languageId, document, startLine) === 'html') {
          let [start, end] = singleLineComment()
          let indentSpaces = document.lineAt(startLine).firstNonWhitespaceCharacterIndex

          return edit.insert(
            selection.start,
            `${' '.repeat(indentSpaces)}${start}${document.getText(selection).trim()}${end}${end_of_line}`
          )
        }

        let concatStr = document
          .getText(selection)
          .split(/\r?\n/)
          .map((s) => (s.trim() ? `${this.singleLineComment} ` + s : s))
          .join(end_of_line)
        edit.insert(selection.start, concatStr)
      } else {
        // 提取表达式（放在上一行）￥
        this.extractVariable(startLine - 1, document, selection, edit)
      }
    } else {
      if (selections.some((selection) => document.getText(selection))) {
        let { isEmpty, notEmpty } = this.emptyAndNotEmpty(document, selections)
        const emptySelectedPos = isEmpty.active

        if (this.languageId !== 'shellscript') {
          if (this.languageId === 'go' && notEmpty.end.line !== notEmpty.start.line) {
            const { trimText: structName } = this.textAndLine(document, isEmpty.active.line)

            let start = `type ${structName} struct {`
            let middle = document.getText(notEmpty)
            let end = '}'

            let middle2 = document.lineAt(notEmpty.start.line + 1).text
            let indent = middle2.replace(middle2.trimStart(), '')

            let newStruct = [start, middle, end].join('\n')
            edit.replace(document.lineAt(isEmpty.active.line).range, newStruct)
            edit.replace(notEmpty, `${indent}Hey *${structName}`)
            return
          }
          // 提取表达式（放在指定行）￥
          this.extractVariable(emptySelectedPos.line, document, notEmpty, edit)
        } else {
          // shellscript 提取表达式（需先选中）成变量（放在指定位置）￥
          const emptyLine = this.textAndLine(document, emptySelectedPos.line)
          const position = emptySelectedPos.character
          const variableName = /(\w+)=/.exec(emptyLine.text.slice(0, position))![1]

          let insertText = document.getText(notEmpty)

          for (let i = position; i < emptyLine.text.length; i++) {
            if (emptyLine.text[i] === ' ') continue
            else {
              if (emptyLine.text[i] !== ';') insertText += ';'
              break
            }
          }

          edit.insert(emptySelectedPos, insertText)
          edit.replace(notEmpty, variableName)
        }
      }
    }
  }

  emptyAndNotEmpty(doc: vscode.TextDocument, selections: readonly vscode.Selection[]) {
    let notEmpty: vscode.Selection
    let isEmpty: vscode.Selection

    if (!doc.getText(selections[0])) {
      ;[isEmpty, notEmpty] = selections
    } else {
      ;[notEmpty, isEmpty] = selections
    }
    return { isEmpty, notEmpty }
  }

  private extractVariable(
    line: number,
    doc: vscode.TextDocument,
    selection: vscode.Selection,
    edit: vscode.TextEditorEdit
  ) {
    let { text, range: firstRange } = doc.lineAt(line)

    let re: RegExp
    let partOfString = String.raw`(\w+\s+)?`

    if (this.languageId !== 'csharp') {
      partOfString = this.declareVariableKeywords?.length
        ? `((?:${this.declareVariableKeywords.join('|')})\\s+)?`
        : ''
    }
    re = new RegExp(String.raw`^(\s*)${partOfString}(\w+)`)

    let secondRange = selection
    if (!re.test(text)) {
      return
    }
    let [, indent, declaWord, variableName] = re.exec(text)!

    let end = this.languageId === 'csharp' ? ';' : ''

    if (!declaWord) {
      if (this.languageId === 'go') {
        let goUnique = ':='

        edit.replace(firstRange, `${indent}${variableName}${goUnique}${doc.getText(selection)}`)
        edit.replace(secondRange, variableName)
        return
      } else declaWord = `${this.declareVariableKeywords[0]} `
    } else {
      if (this.languageId === 'python') {
        ;[declaWord, variableName] = ['', declaWord]
      }
    }

    edit.replace(firstRange, `${indent}${declaWord}${variableName} = ${doc.getText(selection)}${end}`)
    edit.replace(secondRange, variableName)
  }

  textAndLine(document: TextDocument, lineNr: number) {
    let line = document.lineAt(lineNr)
    let text = line.text
    const trimText = text.trim()

    return { line, trimText, text }
  }
}
