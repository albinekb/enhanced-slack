const argv = require('yargs')
  .option('theme', {
    alias: 't',
    describe: 'See available at: https://highlightjs.org/static/demo/'
  })
  .option('eject', {
    alias: 'e',
    describe: 'Revert Slack.app to normal'
  })
  .help()
  .argv

const availableThemes = require('./fixtures/hljs-themes')
const path = require('path')
const fsTemp = require('fs-temp/promise')
const asar = require('asar')
const pify = require('pify')
const fsp = require('fs-promise')
const execa = require('execa')
const Listr = require('listr')
const pathExists = require('path-exists')

async function readFileContents (path) {
  const contents = await fsp.readFile(path)
  const string = await contents.toString()
  return string
}

// namespace is used to check that we don't add the script twice
const namespace = '/* INJECTED */'

const slackAppPath = path.join('/Applications', 'Slack.app')
const slackResourcesPath = path.join(slackAppPath, 'Contents', 'Resources')
const asarFileName = 'app.asar'
const asarPath = path.join(slackResourcesPath, asarFileName)
const unmodifiedAsarFileName = 'app.unmodified.asar'
const unmodifiedAsarPath = path.join(slackResourcesPath, unmodifiedAsarFileName)
const unpackedPath = path.join(slackResourcesPath, '_app')
const entryJsPath = path.join(unpackedPath, 'src', 'static', 'index.js')

// Run this in execa since asar.extractAll is sync
const extractAsar = (from, to) => execa('npm', ['run', 'asar', 'extract', from, to])

// This is needed because paths in the asar is somehow relative to the filename -.-
const repackAsar = (from, to) => new Listr([
  {
    title: 'Create temp directory',
    task: (ctx, task) => fsTemp.mkdir().then(tmpPath => { ctx.tmpPath = tmpPath })
  },
  {
    title: 'Extract asar to temp directory',
    task: (ctx, task) => extractAsar(from, ctx.tmpPath)
  },
  {
    title: 'Repack asar to destination',
    task: (ctx, task) => pify(asar.createPackage)(ctx.tmpPath, to)
  },
  {
    title: 'Remove temp directory',
    task: (ctx) => fsp.remove(ctx.tmpPath)
  }
])

const tasks = new Listr([
  {
    title: 'Locating Slack.app',
    task: (ctx, task) => pathExists(slackAppPath)
      .then((exists) => {
        if (!exists) throw new Error(`Couldn't find Slack.app (${slackAppPath})`)
        task.title = `Locating Slack.app (${slackAppPath})`
      })
  },
  {
    title: 'Find app.asar in Slack.app',
    task: (ctx, task) => pathExists(asarPath)
      .then((exists) => {
        if (!exists) throw new Error(`Couldn't find app.asar (${asarPath})`)
        task.title = `Find app.asar in Slack.app (${asarPath})`
      })
  },
  {
    title: `Backup unmodified app.asar`,
    task: (ctx, task) => pathExists(unmodifiedAsarPath)
      .then(exists => {
        if (exists) {
          task.skip('Backup already exists, use --eject to restore backup')
          return
        }

        return repackAsar(asarPath, unmodifiedAsarPath)
      })
      .then(path => path)
  },
  {
    title: `Extract ${unmodifiedAsarFileName}`,
    task: () => extractAsar(unmodifiedAsarPath, unpackedPath)
  },
  {
    title: 'Load index.js',
    task: (ctx) => readFileContents(entryJsPath)
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
    title: 'Load config.json',
    task: (ctx, task) => readFileContents(path.join(__dirname, 'config.json'))
        .then(raw => {
          ctx.rawConfig = raw
        })
        .catch(() => {
          ctx.rawConfig = false

          task.skip('No config.json found.')
        })
  },
  {
    title: 'Load default-config.json',
    enabled: ctx => !ctx.rawConfig,
    task: (ctx, task) => readFileContents(path.join(__dirname, 'fixtures', 'default-config.json'))
        .then(raw => {
          ctx.rawConfig = raw
        })
  },
  {
    title: 'Verify config',
    task: (ctx) => {
      try {
        ctx.config = JSON.parse(ctx.rawConfig)
      } catch (_) {
        throw new Error('Error parsing config')
      }

      return true
    }
  },
  {
    title: `Verify theme`,
    task: (ctx, task) => {
      const theme = argv.theme || ctx.config.theme

      if (!availableThemes.includes(theme)) throw new Error(`Theme "${theme}" does not exist`)

      task.title = `Verify theme (${theme})`
      ctx.overrideConfig = { theme }
    }
  },
  {
    title: 'Merge script',
    task: (ctx) => {
      const newSource = [
        ctx.source.replace(/\n+$/g, ''),
        '\n',
        namespace,
        `const config = JSON.parse(\`${JSON.stringify(Object.assign({}, ctx.config, ctx.overrideConfig))}\`)`,
        ctx.injectSource
      ].join('\n')
      return fsp.writeFile(entryJsPath, newSource)
    }
  },
  {
    title: 'Repack app.asar',
    task: () => pify(asar.createPackage)(unpackedPath, asarPath)
  },
  {
    title: 'Cleanup',
    task: () => fsp.remove(unpackedPath)
  }
])

if (argv.eject) {
  const tasks = new Listr([
    {
      title: 'Check if backup exists',
      task: (ctx, task) => pathExists(unmodifiedAsarPath)
        .then((exists) => {
          if (!exists) throw new Error(`Can't find unmodified asar (${unmodifiedAsarPath})`)
        })
    },
    {
      title: 'Repack app.unmodified.asar to app.asar',
      task: () => repackAsar(unmodifiedAsarPath, asarPath)
    }
  ])

  tasks
    .run()
    .then(() => {
      console.log()
      console.log('🔥 Done ejecting, please restart Slack.app')
      console.log()
    })
    .catch(err => {
      console.error('💥 Error running tasks', err)
    })
} else {
  tasks
  .run()
  .then(() => {
    console.log()
    console.log('🌴  Done, restart Slack.app to see changes 💅')
    console.log()
  })
  .catch(err => {
    console.error('💥 Error running tasks', err)
  })
}
