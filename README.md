# rohi.network

A clone of Omarchy's `omarchy.network` bar widget with two additions: a
public-IPv4 lookup and an in-panel IP settings editor.

## What this adds over the stock widget

**Public IPv4** — a row that looks the address up through
[ipify.org](https://api.ipify.org) on demand. The button says which service it
contacts, because a public-IP lookup is a request to a third party and the user
should know that before pressing it. The lookup never runs on its own; it waits
for the click.

**IP settings** — a screen reached with `s`, or the *IP settings ›* button. It
lists the machine's saved Wi-Fi and Ethernet profiles and lets you switch a
profile between DHCP and a fixed address, with an *Use current IP as fixed*
shortcut that pre-fills from the subnet you are already on.

## Install

```bash
omarchy plugin add https://github.com/RohiRIK/rohi.network --enable
```

The plugin id is `rohi.network`, so it replaces the stock `omarchy.network`
widget rather than sitting beside it. To go back:

```bash
omarchy plugin remove rohi.network --yes
```

Because `manifest.json` records `clonedFrom: omarchy.network`, removing it
while it is enabled re-enables the stock widget automatically. The old
directory is kept as a timestamped backup rather than deleted.

If you removed it while it was disabled, the stock widget does not come back
on its own — enable it:

```bash
omarchy plugin enable omarchy.network
```

## Keys

| Key | Action |
|---|---|
| `s` | Open IP settings |
| `r` | Refresh |
| `w` | Toggle the network on or off |
| `Esc` | Leave IP settings, or close the panel |

## How it works

`Panel.qml` is the stock widget plus two additions. Live link state comes from
the `Quickshell.Networking` types the stock widget already uses.

Anything that needs `nmcli` goes through `settings.py`, which takes one
argument — `public`, `list`, `read`, `current` or `save` — and prints one JSON
object on stdout. Errors come back as `{"error": "..."}` on stdout with a
non-zero exit, so the panel has a single parse path.

The Wi-Fi passphrase never reaches `settings.py`. The stock widget's
`enterpriseConnectScript` passes it on **stdin** into `nmcli connection edit`,
because argv is world-readable through `/proc`.

## Tests

```bash
bash test/run
```

84 checks over four files:

| File | Covers |
|---|---|
| `test/model.test.js` | The 25 pure helpers in `Model.js` — band labels, packet loss, latency formatting, Wi-Fi row sorting, credential prompts, failure mapping |
| `test/settings.test.py` | Every validation branch in the save path, against a fake `nmcli`, so no real connection is touched |
| `test/manifest.test.py` | Manifest schema, entry point, and that the files `Panel.qml` shells out to exist |
| `test/integration.test.js` | Real `nmcli` and `omarchy-network-band` output on this machine |

## CI, and why the runner is narrow

`test/integration.test.js` needs NetworkManager and `omarchy-network-band`,
which exist only on a real desktop, so it runs on a self-hosted runner
registered against this repository.

That runner is Rohi's actual desktop: it holds SSH keys, a logged-in
browser and the credential-vault plugin. So the grant is kept as narrow as
it can be while still working:

- **Ephemeral.** The runner accepts exactly one job, then deregisters
  itself. A standing listener would accept a job from any workflow in the
  repository at any time.
- **One label.** It is addressed as `rohi-desktop`, so no other
  repository's workflow can target it.
- **Push only.** `test.yml` triggers on pushes to `main` and is the only
  workflow containing a self-hosted job. Pull requests — including
  anyone's forks — run in `untrusted.yml`, on `ubuntu-latest` only, with
  `permissions: contents: read`. It never uses `pull_request_target`.

Changes arriving by pull request are therefore reviewed and landed before
anything touches the desktop. The equivalent checks pass locally in
`bash test/run`, so the local run is the fast path and CI is the record.

## Relationship to `omarchy.network`

This is a clone. The stock widget lives in
`/usr/share/omarchy/shell/plugins/panels/network/` and is owned by the omarchy
package, so it must not be edited in place — an `omarchy update` overwrites it.
`manifest.json` records `clonedFrom: omarchy.network` so the origin stays
discoverable.

When stock `omarchy.network` gains a fix, port it here rather than re-cloning:
`Model.js` here is byte-identical to stock, and `Panel.qml` carries the
additions on top of it.

## Security notes

- The public-IP lookup contacts a third party and only runs on an explicit click.
- `save` validates every address, gateway and DNS entry before `nmcli` runs, and
  refuses IPv6, a missing prefix, and a non-network profile.
- Switching back to `auto` clears the static address and gateway, so a stale
  address cannot block a later DHCP renewal.
- Passphrases travel on stdin, never argv.

## License

MIT, matching the stock widget.
