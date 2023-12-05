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

    if (selections.length === 1 && selection.start.line === selection.end.line) {
      const { line } = selection.active

      const pos = insertSemi(line)
      if (pos) {
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
      const { text } = document.lineAt(lineIndex)

      const textTrimEnd = text.trimEnd()
      if (textTrimEnd) {
        const pos = textTrimEnd.length - 1

        if (textTrimEnd[pos] !== semi) {
          return edit.insert(new vscode.Position(lineIndex, pos + 1), semi)
        } else {
          const long = textTrimEnd.slice(0, pos)
          const short = long.trimEnd()
          if (long !== short) {
            let longPos = new vscode.Position(lineIndex, pos)
            let shortPos = longPos.translate(0, short.length - long.length)

            edit.delete(new vscode.Selection(longPos, shortPos))
            editor.selection = new vscode.Selection(longPos, longPos)
          } else {
            return pos
          }
        }
      }

      // const pos = textTrimEnd.length - 1
      // if (textTrimEnd[pos] !== semi) {
      //   if (textTrimEnd) {
      //     edit.insert(new vscode.Position(lineIndex, pos + 1), semi)
      //   }
      //   return -1
      // }
      // return pos
    }
  })

  vscode.commands.registerTextEditorCommand('wonderland.modelRelation', (editor, edit) => {
    const { document, selections } = editor
    if (selections.length !== 2) return

    function spcuLine(i = 0) {
      const line = selections[i].active.line
      const currentLine = document.lineAt(line)
      const splitText = currentLine.text.trim().split(/\s+/)

      return { splitText, currentLine, line }
    }

    let aa = spcuLine()
    type spcuLineRT = ReturnType<typeof spcuLine>
    let a1: spcuLineRT | undefined
    let a2: spcuLineRT | undefined

    if (aa.splitText.length === 1) {
      a1 = aa
      return done()
    } else {
      a2 = aa
      return done(1, 0)
    }

    function done(a = 0, b = 1) {
      const { currentLine, line } = a1 ?? spcuLine(a)
      const { text: field, range, firstNonWhitespaceCharacterIndex: n } = currentLine

      const { splitText: relaModel } = a2 ?? spcuLine(b)
      const reference = relaModel.slice(0, 2)

      const fieldWithType = `${field} ${reference[1]}`
      const rela = `${repeatSpaces(n)} @relation(fields: [${field.trim()}], references: [${reference[0]}])`
      edit.replace(range, [rela, fieldWithType].join('\n'))

      let pos = new vscode.Position(line, n)
      editor.selection = new vscode.Selection(pos, pos)
    }
  })

  vscode.commands.registerTextEditorCommand('wonderland.packageReference', async (editor) => {
    let content = await vscode.env.clipboard.readText()
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

  vscode.commands.registerTextEditorCommand('wonderland.convertAsToBracket', (editor, edit) => {
    // 还是想得太简单了
    const langObject = getInstance(editor.document.languageId as Language)!
    if (langObject?.languageId !== 'typescript') return

    const { document, selection } = editor
    const line = selection.start.line
    const { text, range } = document.lineAt(line)

    let re = /^(.*?)(\w+)\s+as\s+([\w.]+)/

    // input: '  } as Shell & Options&Fuck&Pussy,'
    re = /^(.*?)(\w+)\s+as\s+([\w.]+(?:\s*&\s*[\w.]+)*)/

    if (re.test(text)) {
      const newString = text.replace(re, function (_match, p1, p2, p3) {
        return `${p1}<${p3}>${p2}`
      })

      return edit.replace(range, newString)
    }
  })

  vscode.commands.registerTextEditorCommand('wonderland.functionDeclaration', (editor, edit) => {
    const { document, selection } = editor

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
      function rep(text: string, re: RegExp, selection: vscode.Selection | vscode.Range) {
        const newString = text.replace(
          re,
          (_match, indent, p2, p3, p4) => `${indent}const ${p2} = ${p3} => ${p4}`
        )
        return edit.replace(selection, newString)
      }

      let text = document.getText(selection)
      let re: RegExp
      if (text) {
        re = /^(\s*)function\s+(\w+)(\(.*?\))\s*{.*?\breturn\s+(.*?)\s*}/s
        if (re.test(text)) {
          return rep(text, re, selection)
        }

        re = /^\s*{.*?\breturn\s+(.*?)\s*}/s
        if (re.test(text)) {
          const newString = re.exec(text)![1]
          return edit.replace(selection, newString)
        }

        re = /\bfunction\s+(\(.*?\))\s*{(.*)}/s
        if (re.test(text)) {
          const newString = text.replace(re, (_match, p1, p2: string) => `${p1} => ${p2.trim()}`)
          return edit.replace(selection, newString)
        }
      }

      if (selection.active.line !== selection.end.line) return

      const lineIndex = selection.active.line
      let line = document.lineAt(lineIndex)
      text = line.text
      re = /^(\s*)function\s+(\w+)(\(.*?\))\s*(.*)/
      if (re.test(text)) {
        return rep(text, re, line.range)
      }

      re = /\bfunction\s+(\(.*\))(.*)/
      if (re.test(text)) {
        const newString = text.replace(re, (_match, p1, p2) => `${p1} =>${p2}`)
        return edit.replace(line.range, newString)
      }
    }
  })

  vscode.commands.registerTextEditorCommand('wonderland.moveImportToTop', (editor, edit) => {
    const { document, selection } = editor

    let textLine = document.lineAt(selection.active.line)

    let text = textLine.text
    if (!/^\s*import/.test(text)) {
      return
    }
    edit.delete(textLine.rangeIncludingLineBreak)
    edit.insert(new vscode.Position(1, 0), text.trimStart() + '\n')
  })

  vscode.commands.registerTextEditorCommand('wonderland.multipleStatements', (editor, edit) => {
    const { document, selection } = editor
    const indent = '  '

    const lineIndex = selection.active.line
    const textLine = document.lineAt(lineIndex)
    const { text: lineContent } = textLine
    const preSpaces = repeatSpaces(textLine.firstNonWhitespaceCharacterIndex)

    if (/^\s*(?:if|while)\b/.test(lineContent)) {
      const [end, single] = matchBracket(lineContent)
      const range = new vscode.Range(lineIndex, end, lineIndex, Infinity)

      edit.replace(range, [` {`, `${preSpaces}${indent}${single}`, `${preSpaces}}`].join('\n'))
    }

    // 把单行箭头函数转为多行语句 用官方的就好
    // Add braces to arrow function
    // let text = document.getText(selection)
    // let re = /(.*=>\s*)(.*)/
    // if (text && re.test(text)) {
    //   const newString = text.replace(re, (_match, p1, p2) =>
    //     [`${p1}{`, `${preSpaces}${indent}return ${p2}`, `${preSpaces}}`].join('\n')
    //   )

    //   editor.selection = new vscode.Selection(selection.anchor, selection.anchor)
    //   return edit.replace(selection, newString)
    // }

    // 先放一放, 等碰到了相关场景再来修改
    // else {
    //   let preLine = document.lineAt(line - 1)
    //   edit.insert(new vscode.Position(line - 1, preLine.text.length), ' {')

    //   let n = preLine.firstNonWhitespaceCharacterIndex
    //   edit.insert(new vscode.Position(line, text.length), `\n${' '.repeat(n)}}`)
    // }
  })

  vscode.commands.registerTextEditorCommand('wonderland.multipleVariableAssignment', (editor, edit) => {
    const langObject = getInstance(editor.document.languageId as Language)
    if (langObject?.languageId !== 'javascript' && langObject?.languageId !== 'typescript') {
      return
    }
    const { document, selection } = editor

    const selectionText = document.getText(selection)
    if (!selectionText) {
      return
    }
    const textArray = selectionText.split('\n').filter((e) => e.trim())

    let keys: string[] = []
    let values: string[] = []
    textArray.forEach((e, i) => {
      ;[keys[i], values[i]] = e.split('=')
    })

    edit.replace(selection, `;[${keys.join(',')}] = [${values.join(',')}]`)
  })

  vscode.commands.registerTextEditorCommand('wonderland.CJ', (editor, edit) => {
    const langObject = getInstance(editor.document.languageId as Language)
    const { document, selection } = editor
    const line = selection.start.line
    const { text, range } = document.lineAt(line)

    const join = langObject?.letConst.join('|')
    const re = new RegExp(String.raw`^(\s*(?:${join})\s+)(.*?)\s*=\s*(?:([^?]*)\??\.(\w+))`)

    if (re.test(text)) {
      const newString = text.replace(re, (_match, prefix, dest, p3, src) => {
        let w = dest === src ? dest : `${src}: ${dest}`
        return `${prefix}{ ${w} } = ${p3}`
      })

      return edit.replace(range, newString)
    }
  })
  vscode.commands.registerTextEditorCommand('wonderland.InterfaceOrType', (editor, edit) => {
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

function repeatSpaces(space: number) {
  return ' '.repeat(space)
}

function matchBracket(line: string): [number, string] {
  const [mLeft, mRight] = '()'
  const len = line.length
  let i = line.indexOf(mLeft) + 1
  let layer = 1

  for (; i < len; i++) {
    const c = line[i]
    if (layer === 0) {
      break
    } else if (c === mLeft) layer++
    else if (c === mRight) layer--
  }
  return [i, line.slice(i).trim()]
}

export function deactivate() {}