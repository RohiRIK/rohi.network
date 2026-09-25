#!/usr/bin/env python3
"""Tests for settings.py validation.

settings.py is the only part of this plugin that can change the machine's
network configuration, and it is also the part with no test coverage. These
tests exercise the validation and the nmcli argument construction against a
fake nmcli, so no real connection is ever touched.

Run: python3 test/settings.test.py
"""
import json
import os
import subprocess
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import settings  # noqa: E402


class FakeNmcli:
    """Stand-in for subprocess.run that records calls and replays output.

    Keyed on the argv after `nmcli --escape no`, so a test can name the
    response by the flags it cares about (`-g connection.id,connection.type`)
    without restating the whole command.
    """

    def __init__(self, responses=None):
        self.responses = responses or {}
        self.calls = []

    def __call__(self, args, **kwargs):
        self.calls.append(args)
        rest = list(args)
        if rest[:1] == ['nmcli']:
            rest = rest[1:]
        if rest[:2] == ['--escape', 'no']:
            rest = rest[2:]
        joined = ' '.join(rest)
        # Longest matching prefix wins, so a test can key on the field list
        # (`-g connection.id,connection.type`) without naming the subcommand.
        out = self.responses.get(joined, '')
        best = ''
        for key, value in self.responses.items():
            if joined.startswith(key) and len(key) > len(best):
                best, out = key, value
        if isinstance(out, Exception):
            return subprocess.CompletedProcess(args, 1, '', str(out))
        return subprocess.CompletedProcess(args, 0, out, '')


class ValidationTests(unittest.TestCase):
    """The save path must refuse anything that would break connectivity."""

    def save(self, uuid, method, addresses, gateway, dns, previous=None):
        responses = {}
        if previous is not None:
            responses['-g connection.id,connection.type'] = (
                'TestNet\n%s\n%s\n%s\n%s\n%s\n' % (
                    previous.get('type', '802-11-wireless'),
                    previous.get('method', 'auto'),
                    previous.get('addresses', ''),
                    previous.get('gateway', ''),
                    previous.get('dns', '')))
        fake = FakeNmcli(responses)
        with mock.patch.object(settings.subprocess, 'run', fake):
            with mock.patch.object(sys, 'argv',
                                   ['settings.py', 'save', uuid, method, addresses, gateway, dns]):
                try:
                    result = settings.main()
                    return result, fake
                except ValueError as e:
                    return {'error': str(e)}, fake

    def test_rejects_a_non_network_profile(self):
        result, _ = self.save('u1', 'auto', '', '', '',
                              previous={'type': 'vpn'})
        self.assertIn('error', result)

    def test_rejects_an_unknown_method(self):
        result, _ = self.save('u1', 'dhcpv6', '', '', '',
                              previous={'type': '802-11-wireless'})
        self.assertIn('error', result)
        self.assertIn('DHCP', result['error'])

    def test_rejects_manual_with_no_address(self):
        result, _ = self.save('u1', 'manual', '', '', '',
                              previous={'type': '802-11-wireless'})
        self.assertIn('error', result)
        self.assertIn('prefix', result['error'])

    def test_rejects_an_address_without_a_prefix(self):
        result, _ = self.save('u1', 'manual', '192.168.1.50', '', '',
                              previous={'type': '802-11-wireless'})
        self.assertIn('error', result)

    def test_rejects_an_ipv6_address(self):
        result, _ = self.save('u1', 'manual', '2001:db8::1/64', '', '',
                              previous={'type': '802-11-wireless'})
        self.assertIn('error', result)

    def test_rejects_a_malformed_address(self):
        result, _ = self.save('u1', 'manual', '999.1.1.1/24', '', '',
                              previous={'type': '802-11-wireless'})
        self.assertIn('error', result)

    def test_rejects_an_ipv6_gateway(self):
        result, _ = self.save('u1', 'manual', '192.168.1.50/24', '2001:db8::1', '',
                              previous={'type': '802-11-wireless'})
        self.assertIn('error', result)

    def test_rejects_malformed_dns(self):
        result, _ = self.save('u1', 'manual', '192.168.1.50/24', '', 'not-an-ip',
                              previous={'type': '802-11-wireless'})
        self.assertIn('error', result)

    def test_accepts_a_valid_manual_profile(self):
        result, fake = self.save('u1', 'manual', '192.168.1.50/24', '192.168.1.1', '1.1.1.1',
                                 previous={'type': '802-11-wireless'})
        self.assertNotIn('error', result)
        self.assertTrue(any('connection' in c and 'modify' in c for c in fake.calls))

    def test_accepts_multiple_addresses(self):
        result, _ = self.save('u1', 'manual', '192.168.1.50/24,192.168.1.51/24', '', '',
                              previous={'type': '802-11-wireless'})
        self.assertNotIn('error', result)

    def test_auto_clears_the_static_fields(self):
        # Switching back to DHCP must not leave a stale address behind, or the
        # profile fails to renew.
        result, fake = self.save('u1', 'auto', '192.168.1.50/24', '192.168.1.1', '',
                                 previous={'type': '802-11-wireless'})
        self.assertNotIn('error', result)
        modify = next(c for c in fake.calls if 'modify' in c)
        self.assertEqual(modify[modify.index('ipv4.addresses') + 1], '')
        self.assertEqual(modify[modify.index('ipv4.gateway') + 1], '')

    def test_ignore_auto_dns_follows_the_dns_field(self):
        _, fake = self.save('u1', 'manual', '192.168.1.50/24', '', '1.1.1.1,8.8.8.8',
                            previous={'type': '802-11-wireless'})
        modify = next(c for c in fake.calls if 'modify' in c)
        self.assertEqual(modify[modify.index('ipv4.ignore-auto-dns') + 1], 'yes')

        _, fake = self.save('u1', 'auto', '', '', '',
                            previous={'type': '802-11-wireless'})
        modify = next(c for c in fake.calls if 'modify' in c)
        self.assertEqual(modify[modify.index('ipv4.ignore-auto-dns') + 1], 'no')

    def test_gateway_is_optional_in_manual(self):
        result, _ = self.save('u1', 'manual', '192.168.1.50/24', '', '',
                              previous={'type': '802-11-wireless'})
        self.assertNotIn('error', result)


class ReadTests(unittest.TestCase):
    def test_read_profile_pads_missing_fields(self):
        fake = FakeNmcli({'-g connection.id,connection.type': 'TestNet\n802-3-ethernet\n'})
        with mock.patch.object(settings.subprocess, 'run', fake):
            with mock.patch.object(sys, 'argv', ['settings.py', 'read', 'u1']):
                profile = settings.main()
        self.assertEqual(profile['name'], 'TestNet')
        self.assertEqual(profile['method'], '')
        self.assertEqual(profile['addresses'], '')
        self.assertEqual(profile['uuid'], 'u1')

    def test_read_profile_surfaces_an_nmcli_failure(self):
        fake = FakeNmcli({'-g connection.id,connection.type': 'Error: no such connection'})
        # A non-zero return is what nmcli gives on failure; the helper raises.
        def boom(args, **kwargs):
            return subprocess.CompletedProcess(args, 1, '', 'Error: unknown connection')
        with mock.patch.object(settings.subprocess, 'run', boom):
            with mock.patch.object(sys, 'argv', ['settings.py', 'read', 'nope']):
                with self.assertRaises(ValueError):
                    settings.main()


class PublicIpTests(unittest.TestCase):
    def test_public_ip_validates_the_address(self):
        class FakeResponse:
            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

            def read(self, n):
                return json.dumps({'ip': '203.0.113.7'}).encode()

        with mock.patch.object(settings.urllib.request, 'urlopen', lambda *a, **k: FakeResponse()):
            self.assertEqual(settings.public_ip(), {'ip': '203.0.113.7'})

    def test_public_ip_rejects_a_non_ipv4_payload(self):
        class FakeResponse:
            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

            def read(self, n):
                return json.dumps({'ip': 'not-an-ip'}).encode()

        with mock.patch.object(settings.urllib.request, 'urlopen', lambda *a, **k: FakeResponse()):
            with self.assertRaises(ValueError):
                settings.public_ip()


if __name__ == '__main__':
    unittest.main(verbosity=2)
