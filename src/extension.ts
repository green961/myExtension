import * as vscode from 'vscode'
import { AutoSave, StatusBar } from './save/autoSave'
import { LanguageInstances } from './utility'
import type { Language } from './utility/'
import { determineLang, lineEndings } from './utility/base'
// import { text } from 'stream/consumers'

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
  if (vscode.workspace.workspaceFolders) {
    let statusBar = new StatusBar()
    ctx.subscriptions.push(
      vscode.commands.registerCommand('wonderland.focusChange', () => {
        const autoSaveValue = statusBar.current

        const config = vscode.workspace.getConfiguration()

        config.update(
          'files.autoSave',
          autoSaveValue === 'onFocusChange' ? AutoSave.off : AutoSave.onFocusChange
        )
        // config.update('editor.formatOnSave', autoSaveValue === 'onFocusChange' ? false : true)
        if (autoSaveValue !== 'onFocusChange') {
          config.update('editor.formatOnSave', true)
        }
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

      const textLine = document.lineAt(line)

      const pos = insertSemiAtEnd(line)
      if (pos) {
        const char = selection.active.character
        const { text } = textLine

        if (getSemiPair(text).some(([start, end]) => char > start && char <= end)) {
          edit.insert(selection.active, ';')
        } else {
          editor.selection = new vscode.Selection(line, pos, line, pos)
        }
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
          insertSemiAtEnd(i)
        }
      } else if (!lines.includes(lineStart)) {
        lines.push(lineStart)
        insertSemiAtEnd(lineStart)
      }
    }

    function getSemiPair(text: string) {
      const semiPairs: [number, number][] = []
      for (let i = 0; i < text.length; ) {
        const start = text.indexOf('"', i)
        if (start === -1) {
          return semiPairs
        }
        const end = text.indexOf('"', start + 1)
        semiPairs.push([start, end])
        i = end + 1
      }
    }

    function insertSemiAtEnd(lineIndex: number) {
      const { text } = document.lineAt(lineIndex)

      const textTrimEnd = text.trimEnd()
      if (textTrimEnd) {
        const pos = textTrimEnd.length - 1

        if (textTrimEnd[pos] !== semi) {
          if (/^\s*for\b/.test(text)) {
            edit.insert(selection.active, ';')
          } else {
            return edit.insert(new vscode.Position(lineIndex, pos + 1), semi)
          }
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
    }
  })

  vscode.commands.registerTextEditorCommand('wonderland.CSS', (editor, edit) => {
    console.log()
    const { document, selection } = editor

    const line = selection.active.line
    const textLine = document.lineAt(line)
    const { text } = textLine

    let pos = new vscode.Position(line, text.length)
    editor.selection = new vscode.Selection(pos, pos)
    let s = new vscode.Selection(line, textLine.firstNonWhitespaceCharacterIndex, line, text.indexOf("'"))

    edit.delete(s)
  })

  vscode.commands.registerTextEditorCommand('wonderland.removeClosingTag', (editor, edit) => {
    const { document, selection } = editor

    const line = selection.active.line
    const textLine = document.lineAt(line)
    const { text, range } = textLine
    const dst = text.replace(/<\s*[a-zA-Z\d]+\s+(.*?)>.*/, '<div $1 />')

    edit.replace(range, dst)
  })

  vscode.commands.registerTextEditorCommand('wonderland.SORT', (editor, edit) => {
    const { document, selection } = editor

    let [, quote, henxian, src] = document.getText(selection).match(/("?)(-*)(.+)\1/)!

    const map: Map<string, string> = new Map()
    const arr = src.split(',').filter((e) => e.trim())
    for (let i = 0; i < arr.length; i++) {
      const word = arr[i]

      let wordIgnore = word.toLowerCase()
      if (!map.has(wordIgnore)) {
        map.set(wordIgnore, word)
      } else if (map.get(wordIgnore) !== word) {
        map.set(wordIgnore, word.toUpperCase())
      }
    }

    const dst = [...map.values()].sort(Intl.Collator().compare).join(',')

    edit.replace(selection, `${quote}${henxian}${dst}${quote}`)
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

  vscode.commands.registerTextEditorCommand('wonderland.convert&&2If', async (editor, edit) => {
    const { document, selection } = editor
    const { line } = selection.active
    const { text, range } = document.lineAt(line)

    let aa = new RegExp(String.raw`^(\s*)(.*)\s*&&\s*(.*)`)
    aa = /^(\s*)(.*?)\s*&&\s*(.*)/

    let [, indent, ifConditon, statement] = aa.exec(text)

    let content = [`if (${ifConditon}) {`, `${repeatSpaces(2)}${statement}`, '}']
      .map((e) => `${indent}${e}`)
      .join('\n')

    edit.replace(range, content)
  })

  vscode.commands.registerTextEditorCommand('wonderland.convertIf2&&', async (editor, edit) => {
    const { document, selection } = editor
    const selectionContent = document.getText(selection)
    let [first, second, ...tail] = selectionContent.split('\n')
    let addN = tail.some((e) => !e.trim())

    const matchContent = /(\s*)if\s*\((.*)\)/.exec(first)
    if (!matchContent) {
      return
    }

    const indent = matchContent[1]
    first = matchContent[2]
    second = second.trim()

    const text = `${indent}${first} && (${second})${addN ? '\n' : ''}`

    edit.replace(selection, text)
    editor.selection = new vscode.Selection(selection.end, selection.end)
  })

  vscode.commands.registerTextEditorCommand('wonderland.hollyShit', async (editor) => {
    function generate(name: string, arg: string, type: string) {
      let ss = arg ? `@Args('${arg}') ${arg}` : ''
      return [`@${type}('${name}')`, `async ${name}(${ss}) {\n\n}`].join('\n')
    }
    function concat(lineContent: string, type: string) {
      let [_, name, arg] = extract.exec(lineContent)
      result.push(generate(name, arg, type))
    }

    let content = (await vscode.env.clipboard.readText()).trim()

    const { selection } = editor

    let isTypeQuery = false
    const typeQuery = /\btype\s+Query\b/
    const extract = /^\s*(\w+)\s*(?:\((\w+):.*\))?\s*:/

    let isMutationQuery = false
    const mutationQuery = /\btype\s+Mutation\b/

    let result = []
    let aa = content.split('\n')
    for (let i = 0; i < aa.length; i++) {
      let lineContent = aa[i]

      if (lineContent.trim() === '') {
        continue
      } else if (!isTypeQuery && typeQuery.test(lineContent)) {
        isTypeQuery = true
        continue
      } else if (!isMutationQuery && mutationQuery.test(lineContent)) {
        isMutationQuery = true
        continue
      }

      if (lineContent.trim() === '}') {
        isTypeQuery = isMutationQuery = false
      }

      if (extract.test(lineContent)) {
        concat(lineContent, isTypeQuery ? 'Query' : 'Mutation')
      }
    }

    let str = result.join('\n\n')

    editor.edit((editBuilder) => {
      editBuilder.insert(selection.active, `\n${str}`)
    })
  })

  vscode.commands.registerTextEditorCommand('wonderland.convertAsToBracket', (editor, edit) => {
    // 还是想得太简单了
    const langObject = getInstance(editor.document.languageId as Language)!
    if (langObject?.languageId !== 'typescript') return

    const { document, selection } = editor
    const { line } = selection.start
    const { text, range } = document.lineAt(line)

    let re = /^(.*?)(\w+)\s+as\s+([\w.]+)/

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
    } else if (
      langObject?.languageId === 'javascript' ||
      langObject?.languageId === 'typescript' ||
      langObject?.languageId === 'typescriptreact'
    ) {
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

  vscode.commands.registerTextEditorCommand('wonderland.Println', (editor, edit) => {
    const { document, selection } = editor
    const textLine = document.lineAt(selection.active.line)
    const { text, firstNonWhitespaceCharacterIndex } = textLine
    const preSpaces = repeatSpaces(firstNonWhitespaceCharacterIndex)

    let languageId = editor.document.languageId as Language
    if (languageId === 'python') {
      const PRINT = 'print'

      const re = new RegExp(String.raw`${PRINT}\((.*)\)`)
      if (re.test(text)) {
        edit.replace(textLine.range, `${preSpaces}${re.exec(text)[1]}`)
      } else {
        edit.replace(textLine.range, `${preSpaces}${PRINT}(${text.trim()})`)
      }
    } else if (languageId === 'java') {
      const SOP = 'System.out.println'

      if (text.includes(SOP)) {
        const re = new RegExp(String.raw`${SOP}\((.*)\)`)
        edit.replace(textLine.range, `${preSpaces}${re.exec(text)![1]};`)
      } else {
        edit.replace(textLine.range, `${preSpaces}${SOP}(${textLine.text.trim().replace(';', '')});`)
      }
    } else if (languageId === 'typescript' || languageId === 'javascript') {
      const CL = 'console.log'

      if (text.includes(CL)) {
        const re = new RegExp(String.raw`${CL}\((.*)\)`)
        edit.replace(textLine.range, `${preSpaces}${re.exec(text)![1]}`)
      } else {
        const selectionText = document.getText(selection)
        if (selectionText.trim()) {
          edit.replace(selection, `${CL}(${selectionText})`)
        } else {
          edit.replace(textLine.range, `${preSpaces}${CL}(${textLine.text.trim().replace(';', '')})`)
        }
      }
    } else if (languageId === 'go') {
      const FP = 'fmt.Println'

      if (text.includes(FP)) {
        const re = new RegExp(String.raw`^(\s*)${FP}\((.*)\)`)
        const [, indent, exp] = re.exec(text)
        edit.replace(textLine.range, `${indent}${exp}`)
      } else {
        edit.replace(
          textLine.range,
          `${'\t'.repeat(firstNonWhitespaceCharacterIndex)}${FP}(${textLine.text.trim()})`
        )
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
    // const re = new RegExp(String.raw`^(\s*(?:${join})\s+)?(.*?)\s*=\s*(?:([^?]*)\??\.(\w+))`)
    const re = new RegExp(String.raw`^(\s*(?:(?:${join})\s+)?)(.*?)\s*=\s*(?:([^?]*)\??\.(\w+))`)

    if (selection.isSingleLine && re.test(text)) {
      const newString = text.replace(re, (_match, prefix: string, dest, p3, src) => {
        let w = dest === src ? dest : `${src}: ${dest}`
        if (prefix.trim()) {
          return `${prefix}{ ${w} } = ${p3}`
        } else {
          return `${prefix};({ ${w} } = ${p3})`
        }
      })

      return edit.replace(range, newString)
    } else {
      let [callLine, varLine] = document.getText(selection).split('\n')
      let [, indent, statement] = /^(\s*).*(=.*)/.exec(callLine)!
      let [, aliasName, propName] = /\s*(.*?)\s*=\s*(?:(?:[^?]*)\??\.(\w+))/.exec(varLine)!

      let newString = `${indent};({ ${propName}: ${aliasName} } ${statement})\n`
      editor.selection = new vscode.Selection(selection.end, selection.end)
      edit.replace(selection, newString)
    }
  })

  vscode.commands.registerTextEditorCommand('wonderland.AddJsonTags', async (editor) => {
    let value = await vscode.window.showInputBox({ value: 'json', ignoreFocusOut: true })
    value = value.trim() || 'json'

    const { document, selection } = editor
    const {
      start: { line: start },
      end: { line: end },
    } = selection

    editor.edit((editBuilder) => {
      const re = /\d/
      for (let i = start; i < end; i++) {
        const trimText = document.lineAt(i).text.trim()
        if (!trimText) {
          continue
        }

        const fieldName = trimText.split(/\s+/)[0]
        const tag = value
          .split('.')
          .map((value) => {
            let field = fieldName[0].toLowerCase()
            for (let i = 1; i < fieldName.length; i++) {
              const char = fieldName[i]

              if (re.test(char)) {
                field += char
                continue
              }

              const lowerChar = char.toLowerCase()
              const upperChar = char.toUpperCase()
              field += char === upperChar ? `_${lowerChar}` : char
            }
            return `${value}:"${field}"`
          })
          .join(' ')

        editBuilder.insert(new vscode.Position(i, Infinity), `\t\`${tag}\``)
      }
    })
  })

  vscode.commands.registerTextEditorCommand('wonderland.MethodOrFunction', (editor, edit) => {
    const { document, selection } = editor

    const lineIndex = selection.active.line

    const { text, range } = document.lineAt(lineIndex)

    let re = /(?<=^\s*func\s+)(\w+)\((.*)\)/
    if (re.test(text)) {
      const newString = text.replace(re, (_match, name: string, paramStr: string) => {
        const params = paramStr.split(',').map((e) => e.trim())
        return `(${params.shift()}) ${name}(${params.join(', ')})`
      })
      return edit.replace(range, newString)
    } else {
      re = /\((.*)\)\s*(\w+)\((.*)\)/

      const newString = text.replace(re, (_match, self: string, name: string, restParams) => {
        return `${name}(${self}${restParams ? `, ${restParams}` : ''})`
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
    const lang = determineLang(langObject.languageId, document, lineIndex)

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
      const { document, selection } = editor
      const lineIndex = selection.active.line
      const { text, range } = document.lineAt(lineIndex)

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
    vscode.commands.registerTextEditorCommand('wonderland.ctrlShiftQ', (editor, edit) => {
      const langObject = getInstance(editor.document.languageId as Language)!

      const { document, selection } = editor

      let re = /\bvar\b(.+\bnew\b\s+([\w<>]+))/
      let { text, range } = document.lineAt(selection.active)
      if (langObject.languageId === 'csharp' && re.test(text)) {
        const dsc = text.replace(re, '$2$1')

        edit.replace(range, dsc)
      } else if ((text = langObject.rewriteLine(editor, edit))) {
        vscode.env.clipboard.writeText(text.replace(/;\s*$/, ''))
      }
    })
  )

  ctx.subscriptions.push(
    vscode.commands.registerTextEditorCommand('wonderland.Uncapitalize', async (editor, edit) => {
      const langObject = getInstance(editor.document.languageId as Language)!
      const { document, selection } = editor

      const wordRange = document.getWordRangeAtPosition(selection.active)
      const word = document.getText(wordRange)

      const c = word[0]
      let caseSwitch = `${c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase()}${word.slice(1)}`

      if (langObject.languageId === 'typescript') {
        const lineIndex = selection.active.line
        const re = new RegExp(String.raw`(\w+)\s*:\s*${word}`)
        const result = re.exec(document.lineAt(lineIndex).text)
        const tempVar = result[1]
        const index = result.index

        if (caseSwitch.endsWith('Type')) {
          caseSwitch = caseSwitch.slice(0, -4)
        }

        edit.replace(new vscode.Selection(lineIndex, index, lineIndex, index + tempVar.length), caseSwitch)
      } else {
        edit.replace(wordRange, caseSwitch)
      }

      // await vscode.commands.executeCommand('editor.action.transformToSnakecase')
      // await vscode.commands.executeCommand('editor.action.transformToCamelcase')
      // 用这两个命令在 ctrl+z 的时候会有中间结果`update_user_dto`
      // update(@Body() updateUserDto: update_user_dto) {
    })
  )

  ctx.subscriptions.push(
    vscode.commands.registerTextEditorCommand('wonderland.splitStatement', (editor, edit) => {
      const { document, selection } = editor

      const {
        text,
        range,
        firstNonWhitespaceCharacterIndex: indentSize,
      } = document.lineAt(selection.active)

      let re = /(?<=\bif)(\s+.*;)/

      if (re.test(text)) {
        let extractStr: string
        const newString = text.replace(re, function (matched) {
          extractStr = matched
          return ''
        })

        edit.replace(range, `${'\t'.repeat(indentSize)}${extractStr.trim().replace(';', '')}\n${newString}`)
      } else {
        if (/^\s*if\s+/.test(text)) {
          const { text: textPre, rangeIncludingLineBreak } = document.lineAt(selection.active.line - 1)

          edit.delete(rangeIncludingLineBreak)
          const [indent, suffix] = text.split('if ')

          edit.replace(range, indent + 'if ' + textPre.trim() + '; ' + suffix)
        } else {
          re = /(\w+)\s*:=/
          if (re.test(text)) {
            const newString = text.replace(re, function (_, varName) {
              return `var ${varName} =`
            })

            edit.replace(range, newString)
          }
        }
      }
    })
  )

  ctx.subscriptions.push(
    vscode.commands.registerTextEditorCommand('wonderland.ctrlPlusq', (editor, edit) => {
      const langObject = getInstance(editor.document.languageId as Language)

      const { document, selection } = editor

      let { text, range } = document.lineAt(selection.active)

      if (langObject.languageId === 'csharp') {
        const re = /\bvar\b(.+\bnew\b\s+([\w<>]+))/
        if (re.test(text)) {
          const dsc = text.replace(re, '$2$1')

          edit.replace(range, dsc)
        }
      } else if ((text = text.trim())) {
        vscode.env.clipboard.writeText(text)
      }
    })
  )

  ctx.subscriptions.push(
    vscode.commands.registerTextEditorCommand('wonderland.ctrlPlusn', (editor, edit) => {
      let id = editor.document.languageId as Language
      const langObject = getInstance(id)
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
    vscode.commands.registerTextEditorCommand('wonderland.ctrlAltPlusy', (editor, edit) => {
      const langObject = getInstance(editor.document.languageId as Language)
      langObject?.ctrlAltPlusy(editor, edit)
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
