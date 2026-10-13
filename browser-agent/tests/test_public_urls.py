import unittest
from unittest.mock import AsyncMock, patch

from browser_policy import read_only_browser
from probe import configure_runtime, RUNTIME_ROOT
from runner import close_browser


class PublicURLTests(unittest.IsolatedAsyncioTestCase):
    async def test_direct_navigation_rejects_private_dns_before_browser_navigation(self):
        from browser_use.browser.events import NavigateToUrlEvent
        configure_runtime()
        browser = read_only_browser(public_web=True, headless=True)
        with patch("public_urls.public_destination", new=AsyncMock(return_value=False)):
            with self.assertRaisesRegex(ValueError, "公开 HTTPS"):
                await browser.on_NavigateToUrlEvent(NavigateToUrlEvent(url="https://private.example.com/"))

    async def test_public_web_watchdog_accepts_new_sites_and_rejects_local_urls(self):
        configure_runtime()
        browser = read_only_browser(public_web=True, headless=True, user_data_dir=str(RUNTIME_ROOT / "public-policy-test"), enable_default_extensions=False)
        try:
            await browser.attach_all_watchdogs()
            policy = browser._security_watchdog
            for url in ["https://developer.mozilla.org/zh-CN/docs/Web", "https://arxiv.org/", "https://example.com:443/"]:
                self.assertTrue(policy._is_url_allowed(url), url)
            for url in ["http://example.com/", "https://localhost/", "https://printer.local/", "https://server.internal/", "https://127.0.0.1/", "https://2130706433/", "https://0x7f000001/", "https://[::1]/", "https://8.8.8.8/", "https://user:pass@example.com/", "https://example.com:8001/", "https://example.com\\@localhost/", "https://example.com/\nsecret", "data:text/html,test"]:
                self.assertFalse(policy._is_url_allowed(url), url)
            self.assertTrue(policy._is_url_allowed("about:blank"))
            self.assertFalse(any(getattr(handler, "__name__", "").startswith("SecurityWatchdog.")
                                 for handlers in browser.event_bus.handlers.values() for handler in handlers))
        finally:
            await close_browser(browser)

    async def test_destination_resolution_fails_closed_for_private_mixed_and_unresolved_hosts(self):
        from public_urls import public_destination
        for addresses, expected in [(["93.184.215.14"], True), (["127.0.0.1"], False), (["10.0.0.1"], False), (["169.254.169.254"], False), (["93.184.215.14", "192.168.1.1"], False), (["::1"], False), ([], False)]:
            result = [(2, 1, 6, "", (ip, 443)) for ip in addresses]
            with patch("asyncio.get_running_loop") as loop:
                loop.return_value.getaddrinfo = AsyncMock(return_value=result)
                self.assertEqual(await public_destination("https://example.com/"), expected, addresses)
        with patch("asyncio.get_running_loop") as loop:
            loop.return_value.getaddrinfo = AsyncMock(side_effect=OSError("DNS failed"))
            self.assertFalse(await public_destination("https://example.com/"))
