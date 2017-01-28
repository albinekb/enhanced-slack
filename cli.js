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

const themes = require('./themes')
const path = require('path')
const fz = require('mz/fs')
const fsTemp = require('fs-temp/promise')
const asar = require('asar')
const pify = require('pify')
const fsp = require('fs-promise')
const execa = require('execa')
const Listr = require('listr')
const pathExists = require('path-exists')

async function readFileContents (path) {
  const contents = await fz.readFile(path)
  const string = await contents.toString()
  return string
}

// namespce is used to check that we don't add the script twice
const namespace = '/* INJECTED */'

const slackRoot = path.join('/Applications', 'Slack.app', 'Contents', 'Resources')
const asarFileName = 'app.asar'
const asarPath = path.join(slackRoot, asarFileName)
const unmodifiedAsarFileName = 'app.unmodified.asar'
const unmodifiedAsarPath = path.join(slackRoot, unmodifiedAsarFileName)
const unpackedPath = path.join(slackRoot, '_app')
const indexJsPath = path.join(unpackedPath, 'src', 'static', 'index.js')

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
    title: 'Pack asar to destination',
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
    task: () => pathExists(slackRoot)
      .then((exists) => {
        if (!exists) throw new Error(`Can't find Slack.app (${slackRoot})`)
      })
  },
  {
    title: `Backup app.asar to ${unmodifiedAsarFileName}`,
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
    title: 'Load config.json',
    task: (ctx, task) => readFileContents(path.join(__dirname, 'config.json'))
        .then(raw => {
          ctx.config = raw
        })
        .catch(() => {
          ctx.config = false

          task.skip('No config.json found.')
        })
  },
  {
    title: 'Load default-config.json',
    enabled: ctx => !ctx.config,
    task: (ctx, task) => readFileContents(path.join(__dirname, 'default-config.json'))
        .then(raw => {
          ctx.config = raw
        })
  },
  {
    title: 'Verify config',
    task: (ctx) => {
      try {
        JSON.parse(ctx.config)
      } catch (_) {
        throw new Error('Error parsing config')
      }

      return true
    }
  },
  {
    title: `Verify theme (${argv.theme})`,
    enabled: () => argv.theme,
    task: (ctx, task) => {
      if (themes.includes(argv.theme)) return
      throw new Error(`Theme "${argv.theme}" does not exist`)
    }
  },
  {
    title: 'Merge script',
    task: (ctx) => {
      const newSource = [
        ctx.source.replace(/\n+$/g, ''),
        '\n',
        namespace,
        `const config = JSON.parse(\`${ctx.config}\`)`,
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
