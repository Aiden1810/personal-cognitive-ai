import unittest

from validation import match_page_excerpt, verify_result
from probe import configure_runtime, create_model


class EvidenceValidationTests(unittest.TestCase):
    def setUp(self):
        self.observations = [{
            "url": "https://example.com/", "title": "Example Domain",
            "text": "Example Domain\nThis domain is for use in documentation examples.",
        }]
        self.result = {"answer": "Read the example page.", "pages": [{
            "url": "https://example.com", "title": "Example Domain",
            "excerpt": "This domain is for use in documentation examples.",
        }]}

    def test_rejects_a_link_that_was_never_visited(self):
        self.result["pages"][0]["url"] = "https://example.com/invented"
        with self.assertRaisesRegex(ValueError, "not observed"):
            verify_result(self.result, self.observations)

    def test_rejects_an_excerpt_missing_from_the_actual_page(self):
        self.result["pages"][0]["excerpt"] = "An invented course is free."
        with self.assertRaisesRegex(ValueError, "excerpt"):
            verify_result(self.result, self.observations)

    def test_rejects_empty_results(self):
        with self.assertRaisesRegex(ValueError, "empty"):
            verify_result({"answer": "", "pages": []}, self.observations)

    def test_accepts_observed_content_and_a_trailing_slash_difference(self):
        verify_result(self.result, self.observations)

    def test_current_model_alias_explicitly_disables_thinking_for_tool_choice(self):
        configure_runtime()
        model = create_model("deepseek-flash", "synthetic-test-key")
        self.assertEqual(model._request_kwargs().get("extra_body"), {"thinking": {"type": "disabled"}})

    def test_excerpt_normalization_returns_actual_typography_not_model_rewriting(self):
        self.assertEqual(match_page_excerpt("Python's syntax is easy.", "Python’s syntax\n is easy."), "Python’s syntax\n is easy.")
        self.assertIsNone(match_page_excerpt("First [...] last", "First sentence. Middle sentence. last sentence."))


if __name__ == "__main__":
    unittest.main()
