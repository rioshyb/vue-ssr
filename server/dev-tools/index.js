import webpack from 'webpack'
import webpackDevMiddleware from 'webpack-dev-middleware'
import MFS from 'memory-fs'
import webpackDev from './webpack-dev'
import webpackHot from './webpack-hot'
import config, {paths} from '../../build/config'
import {clientConfig, serverConfig} from '../../build/webpack'

const readFile = (fs, file) => fs.readFileSync(paths.dist(file), 'utf-8')

export default (app, cb) => {
  let bundle, clientManifest, fs
  let _resolve
  const readyPromise = new Promise(resolve => {
    _resolve = resolve
  })
  const ready = (...args) => {
    _resolve()
    cb(...args)
  }

  clientConfig.entry.push('webpack-hot-middleware/client')

  const clientCompiler = webpack(clientConfig)

  const devMiddleware = webpackDevMiddleware(clientCompiler, {
    publicPath: config.publicPath,
    hot: true,
    quiet: config.quiet,
    noInfo: config.quiet,
    lazy: false,
    stats: config.stats
  })

  clientCompiler.plugin('done', () => {
    fs = devMiddleware.fileSystem
    clientManifest = JSON.parse(readFile(fs, 'vue-ssr-client-manifest.json'))
    bundle && ready(bundle, {clientManifest, fs})
  })

  app.use(webpackDev(clientCompiler, devMiddleware))
  app.use(webpackHot(clientCompiler))

  const serverCompiler = webpack(serverConfig)
  const mfs = new MFS()
  serverCompiler.outputFileSystem = mfs
  serverCompiler.watch({}, (err, stats) => {
    if (err) throw err
    stats = stats.toJson()
    stats.errors.forEach(err => console.error(err))
    stats.warnings.forEach(err => console.warn(err))

    // read bundle generated by vue-ssr-webpack-plugin
    bundle = JSON.parse(readFile(mfs, 'vue-ssr-server-bundle.json'))
    clientManifest && ready(bundle, {clientManifest, fs})
  })

  return readyPromise
}
