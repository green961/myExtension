import * as assert from 'assert'

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode'
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
  console.log('Extension Test Suite 1')
  vscode.window.showInformationMessage('Start all tests.')

  test('Sample test', () => {
    console.log('Sample test 1')
    assert.strictEqual(-1, [1, 2, 3].indexOf(5))
    assert.strictEqual(-1, [1, 2, 3].indexOf(0))
    console.log('Sample test end')
  })
  console.log('Extension Test Suite end')
})
