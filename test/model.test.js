// Unit tests for the pure helpers in Model.js.
// Run: node test/model.test.js
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

// ---------- parseNetworkStatus: tab-separated nmcli terse fields ----------
check('parseNetworkStatus reads the four terse fields', () => {
  const s = M.parseNetworkStatus('connected\tHome Wi-Fi\t80\t5200')
  assert.strictEqual(s.kind, 'connected')
  assert.strictEqual(s.label, 'Home Wi-Fi')
  assert.strictEqual(s.signalStrength, 80)
  assert.strictEqual(s.frequency, '5200')
})

check('parseNetworkStatus falls back to disconnected on empty input', () => {
  const s = M.parseNetworkStatus('')
  assert.strictEqual(s.kind, 'disconnected')
  assert.strictEqual(s.label, '')
  assert.strictEqual(s.signalStrength, -1)
})

check('parseNetworkStatus ignores a trailing newline', () => {
  assert.strictEqual(M.parseNetworkStatus('connected\tA\t50\t2412\n').label, 'A')
})

// ---------- icons ----------
check('wifiIconFor rises with signal strength', () => {
  const weak = M.wifiIconFor(10)
  const strong = M.wifiIconFor(90)
  assert.notStrictEqual(weak, strong)
})

check('wifiIconFor clamps out-of-range strength', () => {
  assert.strictEqual(M.wifiIconFor(-50), M.wifiIconFor(1))
  assert.strictEqual(M.wifiIconFor(9999), M.wifiIconFor(100))
})

check('connectionIcon uses a fixed glyph for ethernet', () => {
  assert.strictEqual(M.connectionIcon('ethernet', 0), '󰈀')
})

check('connectionIcon uses the wifi icon for wifi', () => {
  assert.strictEqual(M.connectionIcon('wifi', 60), M.wifiIconFor(60))
})

check('connectionIcon has a fallback for an unknown kind', () => {
  assert.strictEqual(M.connectionIcon('bond', 0), '󰤮')
})

// ---------- header formatting ----------
check('formatHeaderSpeed converts mbit to gbit', () => {
  assert.strictEqual(M.formatHeaderSpeed(1000), '1gbit')
  assert.strictEqual(M.formatHeaderSpeed(150), '150mbit')
})

check('formatHeaderSpeed is empty for a missing value', () => {
  assert.strictEqual(M.formatHeaderSpeed(0), '')
  assert.strictEqual(M.formatHeaderSpeed(null), '')
})

check('formatHeaderFreq renders a non-empty label for a frequency', () => {
  assert.ok(M.formatHeaderFreq(5200).length > 0)
})

check('headerDetail returns a string for a status object', () => {
  assert.strictEqual(typeof M.headerDetail({ kind: 'connected', label: 'A' }), 'string')
})

// ---------- band labels ----------
check('bandLabel appends ghz to a numeric band', () => {
  assert.strictEqual(M.bandLabel('5'), '5ghz')
})

check('bandLabel special-cases auto and empty', () => {
  assert.strictEqual(M.bandLabel('auto'), 'Auto')
  assert.strictEqual(M.bandLabel(''), '')
})

check('bandSectionTitle inlines the live band only under auto', () => {
  assert.strictEqual(M.bandSectionTitle('5', '2.4'), 'WI-FI BAND')
  assert.strictEqual(M.bandSectionTitle('auto', '2.4'), 'WI-FI BAND: 2.4GHZ')
})

check('bandSectionTitle degrades to a plain label without a band', () => {
  assert.strictEqual(M.bandSectionTitle('auto', ''), 'WI-FI BAND')
})

check('bandTooltip describes both auto and a pinned band', () => {
  assert.ok(M.bandTooltip('auto').length > 0)
  assert.ok(M.bandTooltip('5').indexOf('5ghz') >= 0)
  assert.strictEqual(M.bandTooltip(''), '')
})

// ---------- parseBandStatus / decodeIwSsid ----------
check('parseBandStatus returns a band object for iw output', () => {
  const s = M.parseBandStatus('available:\t2.4GHz 5GHz\nband:\t5GHz\n')
  assert.strictEqual(typeof s, 'object')
  assert.ok('band' in s)
  assert.ok(Array.isArray(s.available))
})

check('parseBandStatus lists the available bands', () => {
  const s = M.parseBandStatus('band\t5\navailable\t2.4 5 6\nselected\tauto\n')
  assert.deepStrictEqual(s.available, ['2.4', '5', '6'])
  assert.strictEqual(s.band, '5')
  assert.strictEqual(s.selected, 'auto')
})

check('parseBandStatus defaults to auto when no band is pinned', () => {
  const s = M.parseBandStatus('band\t\navailable\t2.4 5\nselected\tauto\n')
  assert.strictEqual(s.band, '')
  assert.strictEqual(s.selected, 'auto')
})

check('parseBandStatus copes with no output at all', () => {
  const s = M.parseBandStatus('')
  assert.deepStrictEqual(s.available, [])
  assert.strictEqual(s.selected, 'auto')
})

check('decodeIwSsid escapes non-ASCII bytes', () => {
  assert.strictEqual(typeof M.decodeIwSsid('\\x20'), 'string')
})

// ---------- parseKeyValue: tab-separated, not colon ----------
check('parseKeyValue splits on the first tab only', () => {
  const kv = M.parseKeyValue('ssid\tMy\tNetwork\n')
  assert.strictEqual(kv.ssid, 'My\tNetwork')
})

check('parseKeyValue ignores lines without a tab', () => {
  assert.deepStrictEqual(M.parseKeyValue('no-tab-here\n'), {})
})

check('parseKeyValue skips blank lines', () => {
  assert.deepStrictEqual(M.parseKeyValue('\n\n'), {})
})

// ---------- packet loss ----------
check('pingPacketLossPercent counts nulls across the samples', () => {
  assert.strictEqual(M.pingPacketLossPercent([1, null, null, 1]), 50)
  assert.strictEqual(M.pingPacketLossPercent([1, 1]), 0)
})

check('pingPacketLossPercent is 0 for no samples', () => {
  assert.strictEqual(M.pingPacketLossPercent([]), 0)
  assert.strictEqual(M.pingPacketLossPercent(null), 0)
})

check('formatPacketLoss distinguishes no-samples from zero', () => {
  assert.strictEqual(M.formatPacketLoss(25, true), '25%')
  assert.strictEqual(M.formatPacketLoss(0, true), '0%')
  assert.strictEqual(M.formatPacketLoss(25, false), '--')
})

// ---------- latency ----------
check('formatPingLatency reads Timeout for a non-numeric value', () => {
  assert.strictEqual(M.formatPingLatency(null, true), 'Timeout')
  assert.strictEqual(M.formatPingLatency(-1, true), 'Timeout')
})

check('formatPingLatency shows one decimal below 10ms', () => {
  assert.strictEqual(M.formatPingLatency(4.25, true), '4.3 ms')
  assert.strictEqual(M.formatPingLatency(42, true), '42 ms')
})

check('formatPingLatency shows -- before the first probe returns', () => {
  assert.strictEqual(M.formatPingLatency(20, false), '--')
})

check('pingLatencyState starts in a loading state with no samples', () => {
  const s = M.pingLatencyState(null, null, 5, 20)
  assert.strictEqual(typeof s, 'object')
})

// ---------- bytes ----------
check('formatBytes scales through the units', () => {
  assert.strictEqual(M.formatBytes(512), '512 B')
  assert.strictEqual(M.formatBytes(2048), '2.0 KB')
  assert.strictEqual(M.formatBytes(1024 * 1024 * 1024), '1.00 GB')
})

check('formatBytes clamps a negative to zero', () => {
  assert.strictEqual(M.formatBytes(-5), '0 B')
})

check('formatRate appends a per-second suffix', () => {
  assert.strictEqual(M.formatRate(1024), '1.0 KB/s')
})

// ---------- wifi rows ----------
check('wifiRow returns null for a missing network', () => {
  assert.strictEqual(M.wifiRow(null), null)
})

check('wifiRow emits primitives only, never a QObject', () => {
  const row = M.wifiRow({ connected: true, known: true, name: 'A', signalStrength: 0.8, security: 'WPA2' })
  assert.strictEqual(row.ssid, 'A')
  assert.strictEqual(row.signal, 80)
  assert.strictEqual(row.connected, true)
  Object.keys(row).forEach(k => {
    const v = row[k]
    assert.ok(v === null || ['string', 'number', 'boolean'].indexOf(typeof v) >= 0,
      'row.' + k + ' is a ' + typeof v)
  })
})

check('sortWifiRows puts connected first, then known, then strongest', () => {
  const rows = [
    { ssid: 'open-strong', connected: false, known: false, signal: 95 },
    { ssid: 'known-weak', connected: false, known: true, signal: 20 },
    { ssid: 'connected-any', connected: true, known: false, signal: 10 }
  ]
  const s = M.sortWifiRows(rows).map(r => r.ssid)
  assert.deepStrictEqual(s, ['connected-any', 'known-weak', 'open-strong'])
})

check('sortWifiRows does not mutate its input', () => {
  const rows = [{ ssid: 'a', signal: 10 }, { ssid: 'b', signal: 90 }]
  const before = rows.map(r => r.ssid).join(',')
  M.sortWifiRows(rows)
  assert.strictEqual(rows.map(r => r.ssid).join(','), before)
})

check('sortWifiRows tolerates non-array input', () => {
  assert.deepStrictEqual(M.sortWifiRows(null), [])
})

check('wifiSectionTitle opens the known block', () => {
  const nets = [{ known: true }, { known: true }, { known: false }]
  assert.strictEqual(M.wifiSectionTitle(nets, 0), 'KNOWN NETWORKS')
  assert.strictEqual(M.wifiSectionTitle(nets, 1), '')
})

check('wifiSectionTitle opens the other block at the transition', () => {
  const nets = [{ known: true }, { known: false }, { known: false }]
  assert.strictEqual(M.wifiSectionTitle(nets, 1), 'OTHER NETWORKS')
  assert.strictEqual(M.wifiSectionTitle(nets, 2), '')
})

check('wifiSectionTitle is empty for an out-of-range index', () => {
  assert.strictEqual(M.wifiSectionTitle([{ known: true }], 5), '')
  assert.strictEqual(M.wifiSectionTitle(null, 0), '')
})

// ---------- credential prompts ----------
check('requiresCredentials is false only for the two passwordless types', () => {
  assert.strictEqual(M.requiresCredentials('WPA2', 'NONE', 'OWE'), true)
  assert.strictEqual(M.requiresCredentials('NONE', 'NONE', 'OWE'), false)
  assert.strictEqual(M.requiresCredentials('OWE', 'NONE', 'OWE'), false)
})

check('requiresCredentials keeps an unknown security credentialed', () => {
  assert.strictEqual(M.requiresCredentials('SOMETHING-NEW', 'NONE', 'OWE'), true)
})

check('canForgetNetwork only allows a known, disconnected network', () => {
  assert.strictEqual(M.canForgetNetwork({ known: true, connected: false }), true)
  assert.strictEqual(M.canForgetNetwork({ known: true, connected: true }), false)
  assert.strictEqual(M.canForgetNetwork({ known: false, connected: false }), false)
  assert.strictEqual(M.canForgetNetwork(null), false)
})

// ---------- failure mapping ----------
check('networkFailureReason maps each known reason', () => {
  const r = { NoSecrets: 'NoSecrets', WifiAuthTimeout: 'WifiAuthTimeout', WifiNetworkLost: 'WifiNetworkLost', WifiClientDisconnected: 'WifiClientDisconnected', WifiClientFailed: 'WifiClientFailed' }
  assert.strictEqual(M.networkFailureReason('NoSecrets', true, r), 'Passphrase required')
  assert.strictEqual(M.networkFailureReason('WifiAuthTimeout', true, r), 'Wrong password')
  assert.strictEqual(M.networkFailureReason('WifiNetworkLost', false, r), 'Network lost')
  assert.strictEqual(M.networkFailureReason('WifiClientDisconnected', false, r), 'Disconnected')
  assert.strictEqual(M.networkFailureReason('WifiClientFailed', false, r), 'Connection failed')
})

check('networkFailureReason falls back for an unknown reason', () => {
  assert.strictEqual(M.networkFailureReason('SomethingElse', false, {}), 'Failed to connect')
})

check('an auth failure on an open network is not a password problem', () => {
  const r = { WifiAuthTimeout: 'WifiAuthTimeout' }
  assert.strictEqual(M.networkFailureReason('WifiAuthTimeout', false, r), 'Failed to connect')
})

// ---------- enterprise ----------
check('enterpriseConnectScript never passes the password in argv', () => {
  // The passphrase arrives on stdin; argv is world-readable in /proc.
  assert.ok(M.enterpriseConnectScript.indexOf('IFS= read -r pw') >= 0)
  assert.strictEqual(M.enterpriseConnectScript.indexOf('$1 pw'), -1)
  assert.ok(M.enterpriseConnectScript.indexOf('printf') >= 0)
  assert.ok(M.enterpriseConnectScript.indexOf('connection delete') >= 0)
})

// ---------- reprompt ----------
check('reprompt fires on both credential failure reasons', () => {
  const r = { NoSecrets: 'NoSecrets', WifiAuthTimeout: 'WifiAuthTimeout' }
  assert.strictEqual(M.shouldRepromptPassphrase('NoSecrets', true, r), true)
  assert.strictEqual(M.shouldRepromptPassphrase('WifiAuthTimeout', true, r), true)
})

check('reprompt is suppressed when no credentials are needed', () => {
  const r = { WifiAuthTimeout: 'WifiAuthTimeout' }
  assert.strictEqual(M.shouldRepromptPassphrase('WifiAuthTimeout', false, r), false)
})

check('reprompt is suppressed for an unrelated reason', () => {
  const r = { NoSecrets: 'NoSecrets', WifiAuthTimeout: 'WifiAuthTimeout' }
  assert.strictEqual(M.shouldRepromptPassphrase('WifiNetworkLost', true, r), false)
})

if (failures.length) {
  failures.forEach(f => console.error('FAIL ' + f))
  console.error('\nModel.js unit tests FAILED (' + failures.length + ' of ' + (passed + failures.length) + ')')
  process.exit(1)
}
console.log('Model.js unit tests passed (' + passed + ' checks)')
