// import {workspace} from 'vscode'
import type { Language } from './utility/'
import { checkVue } from './utility/base'
import { lineEndings } from './utility/base'
import * as vscode from 'vscode'
import { LanguageInstances } from './utility'
import { StatusBar, AutoSave } from './save/autoSave'

type LanguageTypes = keyof typeof LanguageInstances
type Instances = {
  [K in LanguageTypes]?: InstanceType<(typeof LanguageInstances)[K]>
}
const langObjects: Instances = {}

export function getInstance(lang: Language) {
  // let lang = editor.document.languageId
  if (lang in LanguageInstances) {
    return getLangObject(lang as LanguageTypes)
  }
}

function getLangObject<K extends LanguageTypes>(key: K): Instances[K] {
  return (langObjects[key] ??= new LanguageInstances[key](key) as any)
}

export function activate(ctx: vscode.ExtensionContext) {
  // ctx.subscriptions.push(new DocumentWatcher())

  if (vscode.workspace.workspaceFolders) {
    let statusBar = new StatusBar()
    ctx.subscriptions.push(
      vscode.commands.registerCommand('wonderland.focusChange', () => {
        vscode.workspace
          .getConfiguration()
          .update(
            'files.autoSave',
            statusBar.current === 'onFocusChange' ? AutoSave.off : AutoSave.onFocusChange
          )
      })
    )
    ctx.subscriptions.push(
      vscode.commands.registerCommand('wonderland.windowChange', () => {
        vscode.workspace
          .getConfiguration()
          .update(
            'files.autoSave',
            statusBar.current === 'onWindowChange' ? AutoSave.off : AutoSave.onWindowChange
          )
      })
    )
  }

  vscode.commands.registerTextEditorCommand('wonderland.insertSemicolon', (editor, edit) => {
    // 行尾加分号
    const semi = ';'
    const { document, selections, selection } = editor

    // document.getText(selection)

    if (selections.length === 1 && selection.start.line === selection.end.line) {
      let line = selection.active.line

      let pos = insertSemi(line)
      if (pos !== -1) {
        editor.selection = new vscode.Selection(line, pos, line, pos)
      }
      return
    }

    let lines: number[] = []
    for (let i = 0; i < selections.length; i++) {
      const selection = selections[i]
      const lineStart = selection.start.line

      if (document.getText(selection) && lineStart !== selection.end.line) {
        const lineEnd = selection.end.line
        for (let i = lineStart; i < lineEnd; i++) {
          insertSemi(i)
        }
      } else if (!lines.includes(lineStart)) {
        lines.push(lineStart)
        insertSemi(lineStart)
      }
    }

    function insertSemi(lineIndex: number) {
      let { text } = document.lineAt(lineIndex)

      let textTrimEnd = text.trimEnd()
      const pos = textTrimEnd.length - 1
      if (textTrimEnd[pos] !== semi) {
        if (textTrimEnd) {
          const insertPosition = new vscode.Position(lineIndex, text.length)
          edit.insert(insertPosition, semi)
        }
        return -1
      }
      return pos
    }
  })

  vscode.commands.registerTextEditorCommand('wonderland.packageReference', async (editor) => {
    let content = await vscode.env.clipboard.readText()
    // const langObject = getInstance(editor)
    const langObject = getInstance(editor.document.languageId as Language)
    let packageVersionRe = /dotnet add package (.*) --version (.*)/
    if (langObject?.languageId !== 'csharp' && !packageVersionRe.test(content)) return

    const { document, selection } = editor

    let line = selection.active.line
    let textLine = document.lineAt(line)
    const [, name, version] = packageVersionRe.exec(content)!

    let replaceText = `<PackageReference Include="${name}" Version="${version}" />`
    const { text, firstNonWhitespaceCharacterIndex: n } = textLine
    editor.edit((editBuilder) => {
      editBuilder.insert(
        new vscode.Position(line, text.length),
        lineEndings[vscode.EndOfLine[document.eol]] + ' '.repeat(n) + replaceText
      )
    })
  })
  vscode.commands.registerTextEditorCommand('wonderland.ofFunction', (editor, edit) => {
    const langObject = getInstance(editor.document.languageId as Language)
    if (langObject?.languageId !== 'csharp') return

    const { document, selection } = editor

    let text = document.getText(selection)
    let re = /\((.*?)\)/g
    if (text && re.test(text)) {
      let tupleString: string[] = []
      for (const e of text.matchAll(re)) {
        tupleString.push(e[1])
      }

      let [keys, values] = tupleString.map((e) => e.split(',').map((e) => e.trim()))

      let s: string[] = []
      keys.forEach((e, i) => {
        s.push(`  ${e} = ${values[i]};`)
      })

      edit.replace(selection, `{\n${s.join('\n')}\n}`)
    } else {
      let line = selection.active.line
      let { text, firstNonWhitespaceCharacterIndex: indentSize } = document.lineAt(line)

      let arrowPos = text.indexOf('=>')
      if (arrowPos === -1) {
        return
      } else {
        let replaceText = text.slice(arrowPos + 2)
        let indent_fn = (n = 1) => ' '.repeat(indentSize * n)

        const replaceRange = new vscode.Range(line, arrowPos, line, text.length)
        edit.replace(replaceRange, `{\n${indent_fn(2)}return ${replaceText}\n${indent_fn()}}`)
      }
    }
  })

  vscode.commands.registerTextEditorCommand('wonderland.convertIfToSingle', (editor, edit) => {
    const { document, selection } = editor

    let selectionContent = document.getText(selection)

    const textArray = selectionContent.split('\n')
    let [condition, statement] = textArray

    const exist = /(\s*)if\s*\((.*)\)/.exec(condition)
    if (exist) {
      let [, indent, ifStatement] = exist
      edit.replace(selection, `${indent}${ifStatement} && ${statement.trim()}\n`)
    }
  })

  vscode.commands.registerTextEditorCommand('wonderland.functionDeclaration', (editor, edit) => {
    const langObject = getInstance(editor.document.languageId as Language)!
    const { document, selection } = editor
    if (langObject.languageId !== 'javascript' && langObject?.languageId !== 'typescript') {
      return
    }

    const line = selection.start.line
    const { text, range } = document.lineAt(line)

    let re = /^(\s*(?:const|let)\s+(\w+)\W+)(function)\s+(.*)/

    if (re.test(text)) {
      const newString = text.replace(re, function (_match, _p1, p2, p3, p4) {
        return `${p3} ${p2}${p4}`
      })

      return edit.replace(range, newString)
    }
  })

  vscode.commands.registerTextEditorCommand('wonderland.arrowFunction', (editor, edit) => {
    const langObject = getInstance(editor.document.languageId as Language)

    const { document, selection } = editor

    if (langObject?.languageId === 'csharp') {
      const startLine = selection.start.line
      const endLine = selection.end.line

      if (startLine === endLine) {
        const currentLine = document.lineAt(startLine)
        const boolOperatorRE = /(\s+bool\s+operator\s*)(==)(\s*\((.*?)\)).*/

        if (boolOperatorRE.test(currentLine.text)) {
          const output = currentLine.text.replace(
            boolOperatorRE,
            function ak(_match, p1: string, _p2, p3: string, p4: string) {
              const equal = p4
                .split(/\s*,\s*/)
                .map((i) => i.split(/\s+/)[1])
                .join(' == ')

              return `${p1}!=${p3} => !(${equal});`
            }
          )

          return edit.insert(new vscode.Position(startLine, 0), `${output}\n\n`)
        }
      }

      let instanceAttributes: string[] = []
      let values: string[] = []

      for (let i = startLine; i < endLine; i++) {
        const { trimText } = langObject.textAndLine(document, i)
        if (trimText.includes(';')) {
          let [instanceAttribute, value] = trimText.replace(';', '').split('=')

          if (!value) {
            values.push(trimText.replace(/^\s*return/, ''))
            break
          }

          instanceAttributes.push(instanceAttribute)
          values.push(value)
        }
      }

      let to: string
      const tupleForm = (vars: string[]) => vars.map((e) => e.trim()).join(', ')

      if (instanceAttributes.length == 1) {
        to = ` => ${tupleForm(instanceAttributes)} = ${tupleForm(values)};`
      } else if (instanceAttributes.length > 1) {
        to = ` => (${tupleForm(instanceAttributes)}) = (${tupleForm(values)});`
      } else {
        to = ` => ${values[0]}`
      }

      let prevStart = document.lineAt(startLine - 1)
      edit.insert(new vscode.Position(startLine - 1, prevStart.text.length), to)
      edit.delete(selection)
    } else if (langObject?.languageId === 'javascript' || langObject?.languageId === 'typescript') {
      let text = document.getText(selection)

      let re = /^(\s*)function\s+(\w+)(\(.*?\))\s*{.*?\breturn\b(.*?)\s*}/s
      if (re.test(text)) {
        const newString = text.replace(re, function ak(_match, p1, p2, p3, p4) {
          return `${p1}const ${p2} = ${p3} => ${p4}`
        })

        return edit.replace(selection, newString)
      }

      re = /^\s*{.*?\breturn\s+(.*?)\s*}/s
      if (re.test(text)) {
        const newString = re.exec(text)![1]

        return edit.replace(selection, newString)
      }
    }
  })

  vscode.commands.registerTextEditorCommand('wonderland.moveImportToTop', (editor, edit) => {
    const langObject = getInstance(editor.document.languageId as Language)
    if (langObject?.languageId !== 'typescript') {
      return
    }
    const { document, selection } = editor

    let textLine = document.lineAt(selection.active.line)

    let text = textLine.text
    if (!/^\s*import/.test(text)) {
      return
    }
    edit.delete(textLine.rangeIncludingLineBreak)
    edit.insert(new vscode.Position(0, 0), text.trimStart() + '\n')
  })

  vscode.commands.registerTextEditorCommand('wonderland.ifMultipleStatements', (editor, edit) => {
    const langObject = getInstance(editor.document.languageId as Language)
    if (langObject?.languageId !== 'javascript' && langObject?.languageId !== 'typescript') {
      return
    }

    const { document, selection } = editor
    let line = selection.active.line
    let selectionLine = document.lineAt(line)

    let text = selectionLine.text
    let exist = text.match(/(\s*)(if\s*\(.*\))(.*)/)
    let tabSize = vscode.workspace.getConfiguration('editor', document.uri).get<number>('tabSize', 2)
    let cc = ' '.repeat(tabSize)
    if (exist) {
      let [, indent, ifStatement, statement] = exist
      statement = statement.trim()

      let concatStr = [`${ifStatement} {`, `${cc}${statement}`, '}'].map((e) => `${indent}${e}`).join('\n')

      edit.replace(selectionLine.range, concatStr)
    } else {
      let preLine = document.lineAt(line - 1)
      edit.insert(new vscode.Position(line - 1, preLine.text.length), ' {')

      let n = preLine.firstNonWhitespaceCharacterIndex
      edit.insert(new vscode.Position(line, text.length), `\n${' '.repeat(n)}}`)
    }
  })

  vscode.commands.registerTextEditorCommand('wonderland.multipleVariableAssignment', (editor, edit) => {
    const langObject = getInstance(editor.document.languageId as Language)
    if (langObject?.languageId !== 'javascript' && langObject?.languageId !== 'typescript') {
      return
    }
    const { document, selection } = editor

    const textArray = document
      .getText(selection)
      .split('\n')
      .filter((e) => e.trim())

    let keys: string[] = []
    let values: string[] = []
    textArray.forEach((e, i) => {
      ;[keys[i], values[i]] = e.split('=')
    })

    edit.replace(selection, `;[${keys.join(',')}] = [${values.join(',')}]`)
  })

  vscode.commands.registerTextEditorCommand('wonderland.convertBetweenInterfaceAndType', (editor, edit) => {
    const langObject = getInstance(editor.document.languageId as Language)
    if (!langObject) {
      return
    }
    const { document, selection } = editor
    const lineIndex = selection.active.line

    // let lang: Language = checkVue(langObject, document, lineIndex)!
    const lang = checkVue(langObject.languageId, document, lineIndex)

    if (langObject.languageId !== 'typescript' && lang !== 'typescript') {
      return
    }

    const { trimText } = langObject.textAndLine(document, lineIndex)

    let arr: string[]
    let replaceContent: string

    let isType = /type\b(.*?)=(.*)/
    if ((arr = isType.exec(trimText)!)) {
      replaceContent = `interface${arr[1].trimEnd()}${arr[2]}`
    } else {
      arr = /interface(\s+\w+(?:\s*<.*>)?\s*)(.*)/.exec(trimText)!

      replaceContent = `type${arr[1]}= ${arr[2]}`
    }

    let { line } = langObject.textAndLine(editor.document, lineIndex)

    edit.replace(line.range, replaceContent)
  })

  vscode.commands.registerTextEditorCommand('wonderland.implementInterface', (editor, edit) => {
    const langObject = getInstance(editor.document.languageId as Language)
    if (langObject?.languageId !== 'go') {
      return
    }

    const { document: doc, selections } = editor
    let [notEmpty, isEmpty] = selections
    let methodNames = doc
      .getText(notEmpty)
      .split('\n')
      .map((e) => e.trim())
      .filter((e) => e.length)

    let { trimText } = langObject.textAndLine(doc, isEmpty.active.line)
    let fn = trimText.slice(0, trimText.indexOf(')') + 1)

    let str = methodNames.map((e) => `${fn} ${e} {\n\n}`).join('\n')

    const startLine = notEmpty.end.line + 1
    const endLine = doc.lineCount - 1

    for (let i = startLine; i <= endLine; i++) {
      let { trimText } = langObject.textAndLine(doc, i)
      if (trimText.length === 0) {
        edit.insert(new vscode.Position(i, 0), str)
        break
      }
    }
  })

  vscode.commands.registerTextEditorCommand('wonderland.stringRaw', (editor, edit) => {
    const langObject = getInstance(editor.document.languageId as Language)
    if (langObject?.languageId === 'javascript' || langObject?.languageId === 'typescript') {
      // String.raw 转为原始字符串 ￥
      const { document: doc, selection } = editor
      const lineIndex = selection.active.line
      const { text, range } = doc.lineAt(lineIndex)

      let pattern = /(['"])(.*)\1/.exec(text)
      let content: string
      if (pattern) content = pattern[2]
      else content = text.trim()

      let replaceContent = `String.raw\`${content}\``

      edit.replace(range, replaceContent)
      editor.selection = new vscode.Selection(lineIndex, 0, lineIndex, 0)
    }
  })

  vscode.commands.registerTextEditorCommand('wonderland.removeEmptyLines', (editor, edit) => {
    const langObject = getInstance(editor.document.languageId as Language)
    if (langObject?.languageId === 'csharp') {
      const { document: doc } = editor
      const { lineCount } = doc
      const removeRanges: vscode.Range[] = []

      for (let i = 0; i < lineCount - 1; i++) {
        let { line, trimText } = langObject.textAndLine(doc, i)
        if (trimText.length === 0) removeRanges.push(line.rangeIncludingLineBreak)
      }

      removeRanges.forEach((e) => {
        edit.delete(e)
      })
    }
  })

  ctx.subscriptions.push(
    vscode.commands.registerTextEditorCommand('wonderland.removeComments', (editor, edit) => {
      const langObject = getInstance(editor.document.languageId as Language)
      langObject?.removeComments(editor, edit)
    })
  )

  ctx.subscriptions.push(
    vscode.commands.registerTextEditorCommand('wonderland.ctrlPlusg', (editor) => {
      const langObject = getInstance(editor.document.languageId as Language)
      langObject?.ctrlPlusg(editor)
    })
  )

  ctx.subscriptions.push(
    vscode.commands.registerTextEditorCommand('wonderland.ctrlPlusn', (editor, edit) => {
      const langObject = getInstance(editor.document.languageId as Language)
      langObject?.ctrlPlusn(editor, edit)
    })
  )

  ctx.subscriptions.push(
    vscode.commands.registerTextEditorCommand('wonderland.ctrlPlusy', (editor, edit) => {
      const langObject = getInstance(editor.document.languageId as Language)
      langObject?.ctrlPlusy(editor, edit)
    })
  )
  ctx.subscriptions.push(
    vscode.commands.registerTextEditorCommand('wonderland.ctrlAltp', (editor, edit) => {
      const langObject = getInstance(editor.document.languageId as Language)
      langObject?.ctrlAltp(editor, edit)
    })
  )
}
export function deactivate() {}
