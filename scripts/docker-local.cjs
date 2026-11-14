#!/usr/bin/env node
// BusyBox wget in GoTrue ignores no_proxy. Keep the actual health check, but
// route ONLY its exact container-loopback URL directly. External requests and
// all other Docker arguments retain their existing networking configuration.
function adaptDockerArgs(args) {
  if (!['run', 'create'].includes(args[0]) && !(args[0] === 'container' && ['run', 'create'].includes(args[1]))) return [...args];
  const directHealth = command => /^wget\s+(?!-Y off\b).*http:\/\/127\.0\.0\.1:9999\/health$/.test(command)
    ? command.replace(/^wget\s+/, 'wget -Y off ') : command;
  return args.map((arg, index) => {
    if (args[index - 1] === '--health-cmd') return directHealth(arg);
    if (arg.startsWith('--health-cmd=')) return '--health-cmd=' + directHealth(arg.slice('--health-cmd='.length));
    return arg;
  });
}
module.exports = {adaptDockerArgs};
if (require.main === module) {
  const {spawnSync} = require('node:child_process');
  const binary = process.env.LUMI_DOCKER_BINARY;
  if (!binary) {console.error('Docker local: binário de origem não configurado. Use npm run db:start.'); process.exit(1);}
  const result = spawnSync(binary, adaptDockerArgs(process.argv.slice(2)), {stdio:'inherit',env:process.env});
  if (result.error) {console.error('Não foi possível executar o Docker local.'); process.exit(1);}
  process.exit(result.status ?? 1);
}
