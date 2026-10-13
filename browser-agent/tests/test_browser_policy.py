import unittest

from probe import configure_runtime, RUNTIME_ROOT
from browser_policy import read_only_browser
from runner import close_browser


class ReadOnlyPolicyTests(unittest.IsolatedAsyncioTestCase):
    async def test_download_handlers_cannot_restore_allow_or_start_http_downloads(self):
        configure_runtime()
        browser = read_only_browser(headless=True, user_data_dir=str(RUNTIME_ROOT / "policy-test-profile"), enable_default_extensions=False)
        try:
            await browser.attach_all_watchdogs()
            self.assertFalse(browser.browser_profile.accept_downloads)
            self.assertFalse(browser.browser_profile.auto_download_pdfs)
            self.assertIsNone(browser._downloads_watchdog)
            self.assertFalse(any(getattr(handler, "__name__", "").startswith("DownloadsWatchdog.")
                                 for handlers in browser.event_bus.handlers.values() for handler in handlers))
        finally:
            await close_browser(browser)
