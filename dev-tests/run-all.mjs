// Runs every logic test in the right mode. Usage: npm run test:logic
import { spawnSync } from 'node:child_process'

const suites = [
  ['test.mjs', false], ['test2.mjs', false], ['test3.mjs', false], ['test4.mjs', false], ['test5.mjs', false],
  ['test6.mjs', false], ['test7.mjs', true], ['test8.mjs', false], ['test9.mjs', true], ['test10.mjs', false], ['test11.mjs', true],
]
let failed = 0
for (const [file, dev] of suites) {
  const r = spawnSync(process.execPath, ['--no-warnings', '--import', './dev-tests/register.mjs', `dev-tests/${file}`], {
    env: { ...process.env, KARTA_DEV: dev ? '1' : '0' }, encoding: 'utf8',
  })
  const line = (r.stdout.match(/\d+ passed, \d+ failed/) ?? [r.status === 0 ? 'ok' : 'FAILED'])[0]
  console.log(`${r.status === 0 ? '✓' : '✗'} ${file.padEnd(12)} ${dev ? '(dev) ' : '      '}${line}`)
  if (r.status !== 0) { failed++; console.log(r.stdout.split('\n').filter((l) => l.includes('FAIL')).join('\n') || r.stderr) }
}
process.exit(failed ? 1 : 0)
