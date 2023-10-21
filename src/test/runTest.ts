import * as path from 'path'

import { runTests } from '@vscode/test-electron'

async function main() {
  console.log('main 1')
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../')
    const extensionTestsPath = path.resolve(__dirname, './suite/index')
    console.log('main 2')
    await runTests({ extensionDevelopmentPath, extensionTestsPath })

    console.log('main 3')
  } catch (err) {
    console.error('Failed to run tests', err)
    process.exit(1)
  }
  console.log('main end')
}

console.log('fish 1')
main()
console.log('fish end')
