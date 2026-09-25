// Live integration checks against the running system.
// These read real state; nothing here modifies a connection.
//
// Run: node test/integration.test.js
const { execFileSync } = require('child_process')
const assert = require('assert')
const M = require('../Model.js')

let passed = 0
const failures = []
function check(name, fn) {
  try {
    fn()
    passed++
  } catch (e) {
    failures.push(name + ': ' + e.message)
  }
}

function sh(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', timeout: 20000 })
}

// ---------- the band helper this plugin depends on ----------
check('omarchy-network-band reports the real band state', () => {
  const raw = sh('omarchy-network-band', [])
  const status = M.parseBandStatus(raw)
  assert.ok(Array.isArray(status.available), 'available is not a list')
  assert.strictEqual(status.selected, 'auto')
})

check('the panel and the band command agree on the label', () => {
  // A disagreement here means the header shows a band the command would not
  // accept, which is the bug the two sides are split over.
  const status = M.parseBandStatus(sh('omarchy-network-band', []))
  if (status.band) {
    const label = M.bandLabel(status.band)
    assert.strictEqual(label, status.band + 'ghz')
  }
})

// ---------- NetworkManager state ----------
check('nmcli reports a device', () => {
  const out = sh('nmcli', ['--escape', 'no', '-t', '-f', 'DEVICE,TYPE', 'device', 'status'])
  assert.ok(out.trim().length > 0, 'no devices reported')
})

check('every device row parses into a known state', () => {
  const out = sh('nmcli', ['--escape', 'no', '-t', '-f',
    'DEVICE,TYPE,STATE,CONNECTION', 'device', 'status'])
  const lines = out.split('\n').filter(Boolean)
  assert.ok(lines.length > 0, 'no devices reported')
  for (const line of lines) {
    const parts = line.split(':')
    assert.ok(parts.length >= 2, 'malformed device row: ' + line)
    const state = parts[2] || ''
    assert.ok(state.length > 0, 'device with no state: ' + line)
  }
})

check('the connected wifi device is visible to the panel', () => {
  const out = sh('nmcli', ['--escape', 'no', '-t', '-f',
    'DEVICE,TYPE,STATE', 'device', 'status'])
  const wifi = out.split('\n')
    .filter(l => l.split(':')[1] === 'wifi' && l.split(':')[2] === 'connected')
  assert.ok(wifi.length > 0, 'no connected wifi device; the bar widget would show nothing')
})

check('band values from the system are ones bandLabel understands', () => {
  const status = M.parseBandStatus(sh('omarchy-network-band', []))
  for (const band of status.available) {
    assert.ok(['2.4', '5', '6'].indexOf(band) >= 0,
      'unexpected band value: ' + band)
  }
})

if (failures.length) {
  failures.forEach(f => console.error('FAIL ' + f))
  console.error('\nIntegration tests FAILED (' + failures.length + ' of ' + (passed + failures.length) + ')')
  process.exit(1)
}
console.log('Integration tests passed (' + passed + ' checks)')
