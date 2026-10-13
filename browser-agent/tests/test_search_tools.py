import unittest

from probe import configure_runtime


class SearchBoundaryTests(unittest.TestCase):
    def test_agent_has_only_the_controlled_search_entry_and_no_write_or_script_tools(self):
        configure_runtime()
        from runner import search_tools
        names = set(search_tools().registry.registry.actions)
        self.assertIn("search_bing", names)
        self.assertTrue({"search", "write_file", "read_file", "evaluate", "upload_file", "input"}.isdisjoint(names))


if __name__ == "__main__":
    unittest.main()
