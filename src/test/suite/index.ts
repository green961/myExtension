import * as path from 'path'
import * as Mocha from 'mocha'
import * as glob from 'glob'

export function run(): Promise<void> {
  console.log('run 1')
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
  })
  const testsRoot = path.resolve(__dirname, '..')
  console.log('run end')
  return new Promise((c, e) => {
    console.log('run end Promise 1')
    glob('**/**.test.js', { cwd: testsRoot }, (err, files) => {
      console.log("glob('**/**.test 1")
      if (err) {
        console.log('if (err) {')
        return e(err)
      }

      files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)))

      try {
        mocha.run((failures) => {
          console.log('mocha.run((failures')
          if (failures > 0) {
            console.log('if (failures > 0) {')
            e(new Error(`${failures} tests failed.`))
          } else {
            console.log('if (failures > 0) { else')
            c()
          }
        })
      } catch (err) {
        console.error(err)
        console.log("glob('**/**.test catch")
        e(err)
      }
      console.log("glob('**/**.test end")
    })
    console.log('run end Promise end')
  })
}
