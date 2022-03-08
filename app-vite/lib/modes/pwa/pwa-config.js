
const { join } = require('path')

const appPaths = require('../../app-paths')
const escapeRegexString = require('../../helpers/escape-regex-string')
const {
  createViteConfig, extendViteConfig,
  createBrowserEsbuildConfig, extendEsbuildConfig
} = require('../../config-tools')

const quasarVitePluginPwaResources = require('./vite-plugin.pwa-resources')
const appPkg = require(appPaths.resolve.app('package.json'))

module.exports = {
  vite: quasarConf => {
    const cfg = createViteConfig(quasarConf)

    cfg.plugins.push(
      quasarVitePluginPwaResources(quasarConf)
    )

    return extendViteConfig(cfg, quasarConf, { isClient: true })
  },

  workbox: quasarConf => {
    const { workboxMode } = quasarConf.pwa
    const opts = {}

    if (quasarConf.ctx.dev === true) {
      // dev resources are not optimized (contain maps, unminified code)
      // so they might be larger than the default maximum size for caching
      opts.maximumFileSizeToCacheInBytes = Number.MAX_SAFE_INTEGER
    }

    if (workboxMode === 'generateSW') {
      const { extendGenerateSWOptions } = quasarConf.pwa

      Object.assign(opts, {
        sourcemap: quasarConf.build.sourcemap !== false,
        mode: quasarConf.metaConf.debugging === true ? 'development' : 'production',
        cacheId: appPkg.name || 'quasar-pwa-app',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true
      })

      if (quasarConf.ctx.dev === true && quasarConf.build.ignorePublicFolder === true) {
        // we don't have a public folder, so we can't use the glob* props,
        // but then we need a runtime caching at least
        opts.runtimeCaching = [{
          urlPattern: `${quasarConf.build.publicPath || '/'}${quasarConf.pwa.manifestFilename}`,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'static-manifest',
            expiration: {
              maxEntries: 4,
              maxAgeSeconds: 60 * 60
            }
          }
        }]
      }
      else {
        Object.assign(opts, {
          globDirectory: quasarConf.ctx.dev === true
            ? appPaths.publicDir
            : quasarConf.build.distDir,
          globPatterns: [ '**/*' ],
          globIgnores: [ `**/${quasarConf.pwa.swFilename}`, '**/workbox-*' ]
        })
      }


      if (quasarConf.ctx.prod === true) {
        opts.navigateFallback = 'index.html'
        opts.navigateFallbackDenylist = [
          new RegExp(escapeRegexString(quasarConf.pwa.swFilename) + '$'),
          /workbox-(.)*\.js$/
        ]
      }

      if (typeof extendGenerateSWOptions === 'function') {
        extendGenerateSWOptions(opts)
      }

      opts.swDest = quasarConf.ctx.dev === true
        ? appPaths.resolve.app(`.quasar/pwa/${quasarConf.pwa.swFilename}`)
        : join(quasarConf.build.distDir, quasarConf.pwa.swFilename)
    }
    else {
      const { extendInjectManifestOptions } = quasarConf.pwa

      if (quasarConf.ctx.prod === true || quasarConf.build.ignorePublicFolder !== true) {
        Object.assign(opts, {
          globDirectory: quasarConf.ctx.dev === true
            ? appPaths.publicDir
            : quasarConf.build.distDir,
          globPatterns: [ '**/*' ],
          globIgnores: [ `**/${quasarConf.pwa.swFilename}`, '**/workbox-*' ]
        })
      }

      if (typeof extendInjectManifestOptions === 'function') {
        extendInjectManifestOptions(opts)
      }

      opts.swSrc = appPaths.resolve.app(`.quasar/pwa-sw/compiled-sw.js`)
      opts.swDest = quasarConf.ctx.dev === true
        ? appPaths.resolve.app(`.quasar/pwa/${quasarConf.pwa.swFilename}`)
        : join(quasarConf.build.distDir, quasarConf.pwa.swFilename)
    }

    return opts
  },

  customSw: quasarConf => {
    const cfg = createBrowserEsbuildConfig(quasarConf, { cacheSuffix: 'inject-manifest-custom-sw' })

    cfg.entryPoints = [ quasarConf.sourceFiles.serviceWorker ]
    cfg.outfile = appPaths.resolve.app(`.quasar/pwa-sw/compiled-sw.js`)

    return extendEsbuildConfig(cfg, quasarConf.pwa, 'CustomSW')
  }
}
