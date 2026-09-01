const path = require('node:path')
const packageJson = require('../package.json')

const channel = process.env.OPENFLOW_BUILD_CHANNEL
if (!['dev', 'candidate'].includes(channel)) throw new Error('OPENFLOW_BUILD_CHANNEL must be dev or candidate')

const identity = channel === 'dev'
  ? { productName: 'OpenFlow Studio Dev', appId: 'com.openflow.studio.dev', packageName: 'openflow-studio-dev' }
  : { productName: 'OpenFlow Studio Candidate', appId: 'com.openflow.studio.candidate', packageName: 'openflow-studio-candidate' }
const versionOverride = process.env.OPENFLOW_PACKAGE_VERSION_OVERRIDE || packageJson.version

module.exports = {
  ...packageJson.build,
  appId: identity.appId,
  productName: identity.productName,
  artifactName: `${identity.productName}-Setup-${versionOverride}.\${ext}`,
  publish: [],
  extraMetadata: {
    name: identity.packageName,
    version: versionOverride,
  },
  extraResources: packageJson.build.extraResources || [],
  directories: {
    ...packageJson.build.directories,
    output: path.join('build-dist', channel),
  },
  nsis: {
    ...packageJson.build.nsis,
    shortcutName: identity.productName,
  },
}
