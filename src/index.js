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
  version: core.getInput('version', {required: true}).replace(/^v/, ''), // strip the 'v' prefix
  githubToken: core.getInput('github-token'),
}

// main action entrypoint
async function runAction() {
  let version

  if (input.version.toLowerCase() === 'latest') {
    core.debug('Requesting latest hurl version...')
    version = await getLatestHurlVersion(input.githubToken)
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
 * @throws
 */
async function doInstall(version) {
  const pathToInstall = path.join(os.tmpdir(), `hurl-${version}`)
  const cacheKey = `hurl-cache-${version}-${process.platform}-${process.arch}`

  core.info(`Version to install: ${version} (target directory: ${pathToInstall})`)

  let restoredFromCache = undefined

  try {
    restoredFromCache = await cache.restoreCache([pathToInstall], cacheKey)
  } catch (e) {
    core.warning(e)
  }

  if (restoredFromCache !== undefined) { // cache HIT
    core.info(`👌 Hurl restored from cache`)
  } else { // cache MISS
    const distUri = getHurlURI(process.platform, process.arch, version)

    core.info(`📦 Downloading the distributive: ${distUri}`)

    const distPath = await tc.downloadTool(distUri)
    const pathToUnpack = path.join(os.tmpdir(), `hurl.tmp`)

    switch (true) {
      case distUri.endsWith('tar.gz'):
        await tc.extractTar(distPath, pathToUnpack)
        await io.rmRF(distPath)

        const files = await (await glob.create(path.join(pathToUnpack, `hurl-${version}*`))).glob()

        core.info(files.join('\n'))

        if (files.length !== 1) {
          throw new Error('Distributive archive contains more than one entry')
        }



        await io.mv(files[0], pathToInstall)

        break

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
 * @throws
 */
async function doCheck() {
  const hurlBinPath = await io.which('hurl', true)

  if (hurlBinPath === "") {
    throw new Error('hurl binary file not found in $PATH')
  }

  await exec.exec('hurl', ['--version'], {silent: true})

  core.setOutput('hurl-bin', hurlBinPath)

  core.info(`Hurl installed: ${hurlBinPath}`)
}

/**
 * @param {string} githubAuthToken
 * @returns {Promise<string>}
 */
async function getLatestHurlVersion(githubAuthToken) {
  const octokit = github.getOctokit(githubAuthToken)

  // docs: https://octokit.github.io/rest.js/v18#repos-get-latest-release
  const latest = await octokit.rest.repos.getLatestRelease({
    owner: 'Orange-OpenSource',
    repo: 'hurl',
  })

  return latest.data.tag_name.replace(/^v/, '') // strip the 'v' prefix
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
 * @throws
 */
function getHurlURI(platform, arch, version) {
  const baseUrl = 'https://github.com/Orange-OpenSource/hurl/releases/download'

  switch (platform) {
    case 'linux': {
      if (semver.lt(version, '4.1.0', true)) {
        if (arch === 'x64') { // Amd64
          return `${baseUrl}/${version}/hurl-${version}-x86_64-linux.tar.gz`
        }
      }

      if (arch === 'x64') { // Amd64
        return `${baseUrl}/${version}/hurl-${version}-x86_64-unknown-linux-gnu.tar.gz`
      }

      throw new Error('Unsupported linux architecture')
    }

    case 'darwin': {
      const osName = semver.lt(version, '1.7.0', true) ? 'osx' : 'macos'

      switch (arch) {
        case 'arm64':
          return `${baseUrl}/${version}/hurl-${version}-arm64-${osName}.tar.gz`

        case 'x64':
          return `${baseUrl}/${version}/hurl-${version}-x86_64-${osName}.tar.gz`
      }

      throw new Error('Unsupported MacOS architecture')
    }

    case 'win32': {
      switch (arch) {
        case 'x64': // Amd64
          return `${baseUrl}/${version}/hurl-${version}-win64.zip`
      }

      throw new Error('Unsupported windows architecture')
    }
  }

  throw new Error('Unsupported OS (platform)')
}

// run the action
(async () => {
  await runAction()
})().catch(error => {
  core.setFailed(error.message)
})
