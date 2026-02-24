import { Template } from 'e2b'

export const template = Template()
  .fromImage('e2bdev/base')
  .runCmd('sudo apt-get update && sudo apt-get install -y git curl unzip')
  .runCmd('curl -fsSL https://bun.sh/install | bash')
  .runCmd('sudo ln -s /home/user/.bun/bin/bun /usr/local/bin/bun')
  .runCmd('sudo mkdir -p /app && sudo chown user:user /app')
