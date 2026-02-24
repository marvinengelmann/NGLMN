import { Template, defaultBuildLogger } from 'e2b'
import { template } from './template'

const alias = process.argv[2] ?? 'anima-dev'

async function main() {
  const buildInfo = await Template.build(template, alias, {
    onBuildLogs: defaultBuildLogger(),
  })

  console.log(`\nTemplate built: ${buildInfo.templateId}`)
  console.log(`Alias: ${buildInfo.alias}`)
}

main().catch(console.error)
