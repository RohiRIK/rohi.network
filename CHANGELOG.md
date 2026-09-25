# Changelog

## 0.2.0

- Public IPv4 lookup through ipify.org, on demand only, with the contacting
  service named on the button.
- IP settings screen (`s`, or *IP settings ›*): list the saved Wi-Fi and
  Ethernet profiles, switch one between DHCP and a fixed address, set gateway
  and DNS, and pre-fill from the current subnet with *Use current IP as fixed*.
- `settings.py` holds every `nmcli` call behind one JSON-per-invocation
  interface, with validation that refuses IPv6, a missing prefix, and any
  profile that is not Wi-Fi or Ethernet.
- Tests: 84 checks over `Model.js`, the save path, the manifest contract, and
  live `nmcli` output.

## 0.1.0

- Cloned from `omarchy.network`. Identical to stock at this point.
