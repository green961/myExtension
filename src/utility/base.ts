import type { TextDocument, TextEditor, TextEditorEdit } from 'vscode'
import * as vscode from 'vscode'
import { getInstance } from '../extension'
import type { Language } from './index'

export const lineEndings = {
  CRLF: '\r\n',
  LF: '\n',
}

function singleLineCommentRemove() {
  return ['<!-- ', ' -->']
}

export const determineLang = (instance: Language, document, startLine): Language => {
  if (instance === 'vue' || instance === 'html') {
    for (let i = startLine - 1; i >= 0; i--) {
      const { text } = document.lineAt(i)
      if (/<\/script>/.test(text)) {
        return
      }

      if (/^\s*<script/.test(text)) {
        return 'javascript'
      }
    }

    // return instance
  }
}

export class Base {
  readonly preserveFlag = '￥'
  readonly singCommRE = new RegExp(String.raw`(?<=^\s*)(?:${this.singleLineComment}\s*)`)
  startDetection?: RegExp
  letConst = ['var']
  letConstType?: string[]
  public embeddedLanguage: Language

  constructor(public singleLineComment: string, readonly languageId: Language) {
    this.embeddedLanguage = languageId

    switch (languageId) {
      case 'rust':
        this.letConst = ['let']
        break
      case 'javascript':
        this.letConst = ['let', 'const']
        this.startDetection = new RegExp(String.raw`${this.singleLineComment}\s*@ts-check`)
        break
      case 'typescript':
        this.startDetection = new RegExp(String.raw`${this.singleLineComment}\s*@ts-nocheck`)
        this.letConst = ['let', 'const', 'type']
        break
      case 'vue':
        this.letConst = ['let', 'const', 'type']
        break
      case 'sql':
        this.singleLineComment = '--'
        break
      case 'yaml':
      case 'powershell':
      case 'dockercompose':
      case 'dockerfile':
      case 'env':
        this.singleLineComment = '#'
        break
    }
  }

  addComments(text: string) {
    let [, intendent, str] = /^(\s*)(.*)/.exec(text)!

    const lang = this.languageId
    if (lang === 'html') {
      let [start, end] = singleLineCommentRemove()
      return `${intendent}${start}${str}${end}`
    }

    // let { singleLineComment } = this
    // if (this.languageId !== lang) {
    //   const langObject = getInstance(lang)
    //   singleLineComment = langObject.singleLineComment
    // }

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

  ctrlAltPlusy(editor: TextEditor, edit: TextEditorEdit) {
    editor.selections.forEach((selection) => {
      let lineIndex = selection.active.line
      let { text, line } = this.textAndLine(editor.document, lineIndex)

      let [, spaces, content] = text.match(/^(\s*)(\S.*)?/)

      if (!content) spaces = ''

      edit.replace(line.range, spaces)
    })
  }

  ctrlPlusy(editor: TextEditor, edit: TextEditorEdit) {
    const { document, selections, selection } = editor

    if (selections.length === 2) {
      let [t0, t1] = selections.map((selection) => document.getText(selection))

      if (t0 || t1) {
        if (t0 && t1) {
          // 两个选中内容之间的交换

          let values = [t1, t0]
          selections.forEach((selection, i) => {
            edit.replace(selection, values[i])
          })
          editor.selection = new vscode.Selection(selection.end, selection.end)
        } else {
          let { isEmpty, notEmpty } = this.emptyAndNotEmpty(document, selections)
          let value = document.getText(notEmpty)

          // if (!value.includes('\n')) {
          if (notEmpty.isSingleLine) {
            // vscode.env.clipboard.writeText(value.trim())

            // "body": "${1|type,input|} $0 {\n}\n"
            // "body": "type" 在字符串里面, 空格不是多余的

            vscode.env.clipboard.writeText(value)
          }

          edit.insert(isEmpty.active, value)
          editor.selection = new vscode.Selection(isEmpty.active, isEmpty.active)
        }
      } else {
        // 两行之间交换. 如果有一个光标处在行首或者行尾, 则把另一行的内容移动过来
        if (selections[0].active.line === selections[1].active.line) {
          return this.rewriteLine(editor, edit)
        }
        let emptyPosition: vscode.Position | undefined
        let deleteLine: vscode.TextLine | undefined
        let copyLineText = ''
        let isFirstLine = false
        selections.forEach((e) => {
          let { line, character } = e.active
          const currentLine = document.lineAt(line)
          const { text } = currentLine

          if (!deleteLine && !text.trim()) {
            deleteLine = currentLine
            if (!emptyPosition) {
              emptyPosition = new vscode.Position(line, text.length)
            }

            return
          }

          const [before, after] = [text.slice(0, character), text.slice(character)]

          if (!after.trim()) {
            emptyPosition = new vscode.Position(line, text.length)
          } else if (!before.trim()) {
            // --放前面立即自减, 保证前后一致的`line`值
            // emptyPosition = new vscode.Position(--line, document.lineAt(line).text.length)
            if (line === 0) {
              isFirstLine = true
              emptyPosition = new vscode.Position(line, 0)
            } else {
              emptyPosition = new vscode.Position(--line, Infinity)
            }
          } else {
            copyLineText = text
            deleteLine = currentLine
          }
        })

        if (emptyPosition && deleteLine) {
          edit.insert(emptyPosition, isFirstLine ? copyLineText + '\n' : '\n' + copyLineText)
          editor.selection = new vscode.Selection(emptyPosition, emptyPosition)
          edit.delete(deleteLine.rangeIncludingLineBreak)
        } else {
          let lines = selections.map((e) => document.lineAt(e.active.line))
          edit.replace(lines[0].range, lines[1].text)
          edit.replace(lines[1].range, lines[0].text)
          editor.selection = new vscode.Selection(selection.active, selection.active)
        }
      }
    } else {
      this.rewriteLine(editor, edit)
    }
  }

  rewriteLine(editor: vscode.TextEditor, edit: vscode.TextEditorEdit): string | undefined {
    const selection = editor.selection
    let lineIndex = selection.active.line
    let { text, line } = this.textAndLine(editor.document, lineIndex)

    // 删除当前行内容，    保留缩进
    // 如果仅仅只有空格, 不保留缩进, 移到行首
    // const [spaces, content] = text.match(/^(?:\s*)(?=\S)/)?.[0] ?? ''
    let [, spaces, content] = text.match(/^(\s*)(\S.*)?/)!

    if (!content) spaces = ''

    edit.replace(line.range, spaces)
    editor.selection = new vscode.Selection(lineIndex, spaces.length, lineIndex, spaces.length)
    return content?.trimEnd()
  }

  ctrlPlusg(editor: TextEditor) {
    const { document, selections } = editor

    // const re = /^(\s*)(get)(\s*=>\s*.*)(;)/
    // if (re.test(document.lineAt(selection.active.line).text)) {
    //   const lineIndex = selection.active.line
    //   const { text } = document.lineAt(selection.active.line)
    //   const newString = text.replace(re, function (_match, p1, _, p3) {
    //     return `${p1}set${p3} = value;\n`
    //   })

    //   const pos = new vscode.Position(lineIndex + 1, 0)
    //   edit.insert(pos, newString)
    //   editor.selection = new vscode.Selection(pos, pos)
    // } else {

    editor.selections = selections.map((selection) => {
      const { line } = selection.active

      const { length } = document.lineAt(line).text

      return new vscode.Selection(line, length, line, length)
    })
  }

  async ctrlPlusn(editor: TextEditor, edit: TextEditorEdit) {
    const { document, selection, selections } = editor
    const startLine = selection.start.line
    let end_of_line = lineEndings[vscode.EndOfLine[document.eol]]

    if (selections.length === 1) {
      if (startLine !== selection.end.line) {
        // 多行，先备份再修改

        if (this.languageId === 'html' || determineLang(this.languageId, document, startLine) === 'html') {
          let [start, end] = singleLineCommentRemove()
          let indentSpaces = document.lineAt(startLine).firstNonWhitespaceCharacterIndex

          return edit.insert(
            selection.start,
            `${' '.repeat(indentSpaces)}${start}${document.getText(selection).trim()}${end}${end_of_line}`
          )
        }

        let concatStr = document.getText(selection)
        if (concatStr.slice(-1) !== end_of_line) {
          concatStr += end_of_line
        }
        const lines = concatStr.split(/\r?\n/)

        const firstLine = lines[0]
        if (firstLine.trim().startsWith(this.singleLineComment)) {
          const findComment = new RegExp(String.raw`^\s*(${this.singleLineComment}\s*)`)
          const comment = findComment.exec(firstLine)![1]
          concatStr = lines.map((s) => (s.trim() ? s.replace(comment, '') : s)).join(end_of_line)
          edit.insert(selection.end, concatStr)
          editor.selection = new vscode.Selection(selection.end, selection.end)
        } else {
          concatStr = lines.map((s) => (s.trim() ? `${this.singleLineComment} ` + s : s)).join(end_of_line)

          edit.insert(selection.start, concatStr)
        }
      } else {
        // 单行，先备份再修改
        let { text: currentLineText, isEmptyOrWhitespace } = document.lineAt(startLine)
        if (isEmptyOrWhitespace) return

        let langObject: Base = this
        if (langObject.languageId === 'html') {
          let lang = determineLang(langObject.languageId, document, startLine)
          if (lang) {
            langObject = getInstance(lang)
          }
        }

        const { singleLineComment: slc } = langObject
        if (currentLineText.trim().startsWith(slc)) {
          let i = currentLineText.indexOf(slc)
          let j = i + slc.length
          for (; j < currentLineText.length; j++) {
            if (currentLineText[j] === ' ') {
              continue
            }
            break
          }

          edit.insert(new vscode.Position(startLine, 0), `${currentLineText}${end_of_line}`)
          edit.delete(
            new vscode.Range(new vscode.Position(startLine, i), new vscode.Position(startLine, j))
          )

          return
        }

        return edit.insert(
          new vscode.Position(startLine, 0),
          `${langObject.addComments(currentLineText)}${end_of_line}`
        )
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

          let langObject: Base = this
          if (langObject.languageId === 'html') {
            langObject = getInstance('javascript')
          }

          // 提取表达式（放在指定行）
          langObject.extractVariable(emptySelectedPos.line, document, notEmpty, edit)
        } else {
          // shellscript 提取表达式（需先选中）成变量（放在指定位置）
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
      } else if (this.languageId === 'python' && selections.length === 2) {
        const [lineA, lineB] = selections.map((s) => {
          let { rangeIncludingLineBreak, text } = document.lineAt(s.active.line)

          const wordRange = document.getWordRangeAtPosition(s.active)
          const word = wordRange && document.getText(wordRange)
          return { rangeIncludingLineBreak, text, word, wordRange }
        })

        if (!lineB.word || lineB.text.includes(lineA.word)) {
          edit.delete(lineB.rangeIncludingLineBreak)
          edit.replace(lineA.wordRange, lineB.text.split('=')[1].trim())
          editor.selection = selection
        } else if (lineA.word) {
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
      partOfString = this.letConst.length ? `((?:${this.letConst.join('|')})\\s+)?` : ''
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
        const typeInterface = /type\s+(\w+)\s+interface/
        if (typeInterface.test(text)) {
          variableName = typeInterface.exec(text)[1]

          edit.insert(new vscode.Position(line, Infinity), `\n\t${doc.getText(selection)}`)
        } else {
          let goUnique = ':='
          edit.replace(firstRange, `${indent}${variableName}${goUnique}${doc.getText(selection)}`)
        }

        edit.replace(secondRange, variableName)
        return
      } else declaWord = `${this.letConst[0]} `
    } else {
      if (this.languageId === 'python') {
        ;[declaWord, variableName] = ['', declaWord]
      }
    }

    edit.replace(
      firstRange,
      `${indent}${declaWord}${variableName} = ${doc.getText(selection)}${end}${
        this.languageId === 'rust' ? ';' : ''
      }`
    )
    edit.replace(secondRange, variableName)
  }

  textAndLine(document: TextDocument, lineNr: number) {
    let line = document.lineAt(lineNr)
    let text = line.text
    const trimText = text.trim()

    return { line, trimText, text }
  }
}
