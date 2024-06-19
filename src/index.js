const core = require('@actions/core') // docs: https://github.com/actions/toolkit/tree/main/packages/core
const tc = require('@actions/tool-cache') // docs: https://github.com/actions/toolkit/tree/main/packages/tool-cache
const github = require('@actions/github') // docs: https://github.com/actions/toolkit/tree/main/packages/github
const io = require('@actions/io') // docs: https://github.com/actions/toolkit/tree/main/packages/io
const cache = require('@actions/cache') // docs: https://github.com/actions/toolkit/tree/main/packages/cache
const exec = require('@actions/exec') // docs: https://github.com/actions/toolkit/tree/main/packages/exec
const glob = require('@actions/glob') // docs: https://github.com/actions/toolkit/tree/main/packages/glob
const semver = require('semver') // docs: https://github.com/npm/node-semver#readme
const path = require('path')
const os = require('os')

// read action inputs
const input = {
  version: core.getInput('version', {required: true}).replace(/^[vV]/, ''), // strip the 'v' prefix
  githubToken: core.getInput('github-token'),
}

// main action entrypoint
async function runAction() {
  let version

  if (input.version.toLowerCase() === 'latest') {
    core.debug('Requesting latest hurl version...')
    version = await getLatestVersion(input.githubToken)
  } else {
    version = input.version
  }

  core.startGroup('💾 Install hurl')
  await doInstall(version)
  core.endGroup()

  core.startGroup('🧪 Installation check')
  await doCheck()
  core.endGroup()
}

/**
 * @param {string} version
 *
 * @returns {Promise<void>}
 *
 * @throws {Error}
 */
async function doInstall(version) {
  const pathToInstall = path.join(os.tmpdir(), `hurl-${version}`)
  const cacheKey = `hurl-cache-${version}-${process.platform}-${process.arch}`

  core.info(`Version to install: ${version} (target directory: ${pathToInstall})`)

  /** @type {string|undefined} */
  let restoredFromCache = undefined

  try {
    restoredFromCache = await cache.restoreCache([pathToInstall], cacheKey)
  } catch (e) {
    core.warning(e)
  }

  if (restoredFromCache) { // cache HIT
    core.info(`👌 Hurl restored from cache`)
  } else { // cache MISS
    const distUri = getDistUrl(process.platform, process.arch, version)

    core.info(`📦 Downloading the distributive: ${distUri}`)

    const distPath = await tc.downloadTool(distUri)
    const pathToUnpack = path.join(os.tmpdir(), `hurl.tmp`)

    switch (true) {
      case distUri.endsWith('tar.gz'): {
        await tc.extractTar(distPath, pathToUnpack)
        await io.rmRF(distPath)

        // since 4.3.0 binary files are located in `./hurl-${version}-${platform}-${arch}/bin`
        // directory (inside the archive), but for the older versions (before 4.3.0) they are
        // located in the `./hurl-${version}-${platform}-${arch}` directory
        const binFilesGlobPattern = path.join(pathToUnpack, semver.lt(version, '4.3.0', true)
          ? `hurl-${version}*` // before 4.3.0
          : `hurl-${version}*/bin`)

        const files = await (await glob.create(binFilesGlobPattern, {
          implicitDescendants: false,
          matchDirectories: true,
        })).glob()

        if (files.length !== 1) {
          throw new Error('Distributive archive contains more than one entry')
        }

        await io.mv(files[0], pathToInstall)

        break
      }

      case distUri.endsWith('zip'):
        await tc.extractZip(distPath, pathToInstall)
        break

      default:
        throw new Error('Unsupported distributive format')
    }

    try {
      await cache.saveCache([pathToInstall], cacheKey)
    } catch (e) {
      core.warning(e)
    }
  }

  core.addPath(pathToInstall)
}

/**
 * @returns {Promise<void>}
 *
 * @throws {Error} binary file not found in $PATH or version check failed
 */
async function doCheck() {
  const binPath = await io.which('hurl', true)

  if (binPath === "") {
    throw new Error('hurl binary file not found in $PATH')
  }

  await exec.exec('hurl', ['--version'], {silent: true})

  core.setOutput('hurl-bin', binPath)
  core.info(`Hurl installed: ${binPath}`)
}

/**
 * @param {string} githubAuthToken
 * @returns {Promise<string>}
 */
async function getLatestVersion(githubAuthToken) {
  /** @type {import('@actions/github')} */
  const octokit = github.getOctokit(githubAuthToken)

  // docs: https://octokit.github.io/rest.js/v18#repos-get-latest-release
  const latest = await octokit.rest.repos.getLatestRelease({
    owner: 'Orange-OpenSource',
    repo: 'hurl',
  })

  return latest.data.tag_name.replace(/^[vV]/, '') // strip the 'v' prefix
}

/**
 * @link https://github.com/Orange-OpenSource/hurl/releases
 *
 * @param {('linux'|'darwin'|'win32')} platform
 * @param {('x32'|'x64'|'arm'|'arm64')} arch
 * @param {string} version E.g.: `1.2.6`
 *
 * @returns {string}
 *
 * @throws {Error} Unsupported platform or architecture
 */
function getDistUrl(platform, arch, version) {
  const baseUrl = `https://github.com/Orange-OpenSource/hurl/releases/download/${version}/`
  const before410 = semver.lt(version, '4.1.0', true) // before 4.1.0

  switch (platform) {
    case 'linux': {
      switch (arch) {
        case 'x64':
          // v4.3.0 - hurl-4.3.0-x86_64-unknown-linux-gnu.tar.gz
          // v4.2.0 - hurl-4.2.0-x86_64-unknown-linux-gnu.tar.gz
          // v4.1.0 - hurl-4.1.0-x86_64-unknown-linux-gnu.tar.gz
          // v4.0.0 - hurl-4.0.0-x86_64-linux.tar.gz
          // v3.0.1 - hurl-3.0.1-x86_64-linux.tar.gz
          // v3.0.0 - hurl-3.0.0-x86_64-linux.tar.gz
          // v2.0.1 - hurl-2.0.1-x86_64-linux.tar.gz
          // v2.0.0 - hurl-2.0.0-x86_64-linux.tar.gz
          // v1.8.0 - hurl-1.8.0-x86_64-linux.tar.gz
          // v1.7.0 - hurl-1.7.0-x86_64-linux.tar.gz
          if (before410) {
            return `${baseUrl}/hurl-${version}-x86_64-linux.tar.gz`
          }

          return `${baseUrl}/hurl-${version}-x86_64-unknown-linux-gnu.tar.gz`
      }

      throw new Error(`Unsupported linux architecture (${arch})`)
    }

    case 'darwin': {
      switch (arch) {
        // v4.3.0 - hurl-4.3.0-x86_64-apple-darwin.tar.gz
        // v4.2.0 - hurl-4.2.0-x86_64-apple-darwin.tar.gz
        // v4.1.0 - hurl-4.1.0-x86_64-apple-darwin.tar.gz
        // v4.0.0 - hurl-4.0.0-x86_64-macos.tar.gz
        // v3.0.1 - hurl-3.0.1-x86_64-macos.tar.gz
        // v3.0.0 - hurl-3.0.0-x86_64-macos.tar.gz
        // v2.0.1 - hurl-2.0.1-x86_64-macos.tar.gz
        // v2.0.0 - hurl-2.0.0-x86_64-macos.tar.gz
        // v1.8.0 - hurl-1.8.0-x86_64-macos.tar.gz
        // v1.7.0 - hurl-1.7.0-x86_64-macos.tar.gz
        case 'x64':
          if (before410) {
            return `${baseUrl}/hurl-${version}-x86_64-macos.tar.gz`
          }

          return `${baseUrl}/hurl-${version}-x86_64-apple-darwin.tar.gz`

        // v4.3.0 - hurl-4.3.0-aarch64-apple-darwin.tar.gz
        // v4.2.0 - hurl-4.2.0-aarch64-apple-darwin.tar.gz
        // v4.1.0 - hurl-4.1.0-aarch64-apple-darwin.tar.gz
        // v4.0.0 - hurl-4.0.0-arm64-macos.tar.gz
        // v3.0.1 - hurl-3.0.1-arm64-macos.tar.gz
        // v3.0.0 - hurl-3.0.0-arm64-macos.tar.gz
        // v2.0.1 - hurl-2.0.1-arm64-macos.tar.gz
        // v2.0.0 - hurl-2.0.0-arm64-macos.tar.gz
        // v1.8.0 - hurl-1.8.0-arm64-macos.tar.gz
        // v1.7.0 - hurl-1.7.0-arm64-macos.tar.gz
        case 'arm64':
          if (before410) {
            return `${baseUrl}/hurl-${version}-arm64-macos.tar.gz`
          }

          return `${baseUrl}/hurl-${version}-aarch64-apple-darwin.tar.gz`
      }

      throw new Error(`Unsupported macOS architecture (${arch})`)
    }

    case 'win32': {
      switch (arch) {
        // v4.3.0 - hurl-4.3.0-x86_64-pc-windows-msvc.zip
        // v4.2.0 - hurl-4.2.0-x86_64-pc-windows-msvc.zip
        // v4.1.0 - hurl-4.1.0-x86_64-pc-windows-msvc.zip
        // v4.0.0 - hurl-4.0.0-win64.zip
        // v3.0.1 - hurl-3.0.1-win64.zip
        // v3.0.0 - hurl-3.0.0-win64.zip
        // v2.0.1 - hurl-2.0.1-win64.zip
        // v2.0.0 - hurl-2.0.0-win64.zip
        // v1.8.0 - hurl-1.8.0-win64.zip
        // v1.7.0 - hurl-1.7.0-win64.zip
        case 'x64':
          if (before410) {
            return `${baseUrl}/hurl-${version}-win64.zip`
          }

          return `${baseUrl}/hurl-${version}-x86_64-pc-windows-msvc.zip`
      }

      throw new Error(`Unsupported windows architecture (${arch})`)
    }
  }

  throw new Error(`Unsupported platform (${platform})`)
}

// run the action
(async () => {
  await runAction()
})().catch(error => {
  core.setFailed(error.message)
})
