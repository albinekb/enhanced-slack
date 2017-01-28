const path = require('path')
const fz = require('mz/fs')
const asar = require('asar')
const pify = require('pify')
const Listr = require('listr')

async function readFileContents (path) {
  const contents = await fz.readFile(path)
  const string = await contents.toString()
  return string
}

const namespace = '/* INJECTED */'
const slackRoot = path.join('/Applications', 'Slack.app', 'Contents', 'Resources')
const asarPath = path.join(slackRoot, 'app.asar')
const unpackedPath = path.join(slackRoot, '_app')
const indexJsPath = path.join(unpackedPath, 'src', 'static', 'index.js')

const tasks = new Listr([
  {
    title: 'Extract app.asar',
    task: () => asar.extractAll(asarPath, unpackedPath)
  },
  {
    title: 'Load index.js',
    task: (ctx) => readFileContents(indexJsPath)
      .then(source => {
        ctx.source = source.includes(namespace) ? source.split(namespace)[0] : source
      })
  },
  {
    title: 'Load inject.js',
    task: (ctx) => readFileContents(path.join(__dirname, 'inject.js'))
      .then(injectSource => {
        ctx.injectSource = injectSource
      })
  },
  {
    title: 'Inject script',
    task: (ctx) => {
      const newSource = [
        ctx.source,
        namespace,
        ctx.injectSource
      ].join('\n')
      return fz.writeFile(indexJsPath, newSource)
    }
  },
  {
    title: 'Repack app.asar',
    task: () => pify(asar.createPackage)(unpackedPath, asarPath)
  }
])

tasks
  .run()
  .then(() => {
    console.log('🌴 Done, restart Slack.app to see changes 💅')
  })
  .catch(err => {
    console.error('ERROR', err)
  })
