"""Public HTTPS navigation checks, not a browser network sandbox."""

import asyncio
import ipaddress
import re
import socket
from urllib.parse import urlsplit

LOCAL_SUFFIXES = ("localhost", "local", "internal", "lan", "home", "test", "invalid", "example", "onion", "arpa")


def public_https_url(value: str) -> bool:
    if not isinstance(value, str) or not value or len(value) > 4000 or re.search(r"[\s\\]", value):
        return False
    try:
        url = urlsplit(value)
        host = (url.hostname or "").lower()
        labels = host.split(".")
        return (url.scheme == "https" and url.username is None and url.password is None and url.port in (None, 443)
                and len(host) <= 253 and len(labels) >= 2
                and all(re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", label) for label in labels)
                and bool(re.fullmatch(r"[a-z]{2,63}|xn--[a-z0-9-]{2,59}", labels[-1]))
                and labels[-1] not in LOCAL_SUFFIXES)
    except ValueError:
        return False


async def public_destination(value: str) -> bool:
    if not public_https_url(value):
        return False
    try:
        addresses = await asyncio.wait_for(asyncio.get_running_loop().getaddrinfo(
            urlsplit(value).hostname, 443, type=socket.SOCK_STREAM), timeout=5)
        return bool(addresses) and all(ipaddress.ip_address(item[4][0]).is_global for item in addresses)
    except (OSError, ValueError, TimeoutError):
        return False


def public_security_watchdog(browser):
    from browser_use.browser.watchdogs.security_watchdog import SecurityWatchdog
    from browser_use.browser.events import NavigateToUrlEvent, NavigationCompleteEvent, TabCreatedEvent

    class PublicWebWatchdog(SecurityWatchdog):
        def _is_url_allowed(self, url: str) -> bool:
            return url == "about:blank" or public_https_url(url)

        async def on_NavigateToUrlEvent(self, event: NavigateToUrlEvent) -> None:
            if event.url != "about:blank" and not await public_destination(event.url):
                raise ValueError("仅能浏览公开 HTTPS 网页，目标地址无法核实或属于本地网络。")
            await super().on_NavigateToUrlEvent(event)

        async def on_NavigationCompleteEvent(self, event: NavigationCompleteEvent) -> None:
            if event.url != "about:blank" and not await public_destination(event.url):
                session = await self.browser_session.get_or_create_cdp_session(target_id=event.target_id)
                await session.cdp_client.send.Page.navigate(params={"url": "about:blank"}, session_id=session.session_id)
                return
            await super().on_NavigationCompleteEvent(event)

        async def on_TabCreatedEvent(self, event: TabCreatedEvent) -> None:
            if event.url != "about:blank" and not await public_destination(event.url):
                await self.browser_session._cdp_close_page(event.target_id)
                return
            await super().on_TabCreatedEvent(event)

    return PublicWebWatchdog(event_bus=browser.event_bus, browser_session=browser)
