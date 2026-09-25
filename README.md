# rohi.network

A clone of Omarchy's `omarchy.network` bar widget with two additions: a
public-IPv4 lookup and an in-panel IP settings editor.

![Panel](preview.png)

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
omarchy plugin add https://github.com/RohiRIK/rohi.network
omarchy plugin enable rohi.network
```

If you are upgrading from a local clone, remove the old directory first — the
plugin id is the same, so two copies would both try to own the bar slot.

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

The last one needs a desktop session, so it runs on a self-hosted runner
rather than in GitHub Actions. The rest run anywhere.

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
