#!/usr/bin/env python3
"""Manifest and shell contract checks.

The plugin only loads if manifest.json matches the schema and the entry point
exists, so a malformed manifest is a silent no-op on the bar rather than an
error. These checks fail loudly instead.
"""
import json
import os
import subprocess
import sys
import unittest

ROOT = os.path.join(os.path.dirname(__file__), '..')


def manifest():
    with open(os.path.join(ROOT, 'manifest.json')) as f:
        return json.load(f)


class ManifestTests(unittest.TestCase):
    def setUp(self):
        self.m = manifest()

    def test_schema_version_is_1(self):
        self.assertEqual(self.m['schemaVersion'], 1)

    def test_id_matches_the_installed_directory(self):
        self.assertEqual(self.m['id'], 'rohi.network')

    def test_declares_a_bar_widget(self):
        self.assertIn('bar-widget', self.m['kinds'])

    def test_entry_point_file_exists(self):
        entry = self.m['entryPoints']['barWidget']
        self.assertTrue(os.path.isfile(os.path.join(ROOT, entry)),
                        'entry point %s is missing' % entry)

    def test_bar_widget_metadata_is_present(self):
        bw = self.m['barWidget']
        for field in ('displayName', 'description', 'category'):
            self.assertIn(field, bw)
        self.assertFalse(bw['allowMultiple'])

    def test_records_the_upstream_it_was_cloned_from(self):
        # Lets `omarchy plugin update` and a future re-clone know where the
        # unpatched original lives.
        self.assertEqual(self.m['omarchy']['clonedFrom'], 'omarchy.network')

    def test_files_the_panel_depends_on_are_present(self):
        # Panel.qml shells out to these; a missing one is a runtime failure
        # that only shows up when the user opens the panel.
        for name in ('Model.js', 'Panel.qml', 'settings.py'):
            self.assertTrue(os.path.isfile(os.path.join(ROOT, name)),
                            '%s is missing' % name)


class SchemaTests(unittest.TestCase):
    def test_omarchy_plugin_validate_passes(self):
        p = subprocess.run(['omarchy', 'plugin', 'validate', ROOT],
                           capture_output=True, text=True)
        self.assertEqual(p.returncode, 0,
                         'omarchy-plugin-validate failed:\n' + p.stdout + p.stderr)


if __name__ == '__main__':
    unittest.main(verbosity=2)
