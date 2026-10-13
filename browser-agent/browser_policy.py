"""Read-only browser policy for the pinned Browser Use 0.13.11 runtime."""


def read_only_browser(*, public_web=False, **options):
    from browser_use import Browser
    from browser_use.browser.events import BrowserStartEvent, NavigateToUrlEvent
    from browser_use.browser.watchdog_base import BaseWatchdog

    class ReadOnlyBrowser(Browser):
        async def on_NavigateToUrlEvent(self, event: NavigateToUrlEvent) -> None:
            if public_web and event.url != "about:blank":
                from public_urls import public_destination
                if not await public_destination(event.url):
                    raise ValueError("仅能浏览公开 HTTPS 网页，目标地址无法核实或属于本地网络。")
            await super().on_NavigateToUrlEvent(event)

        async def attach_all_watchdogs(self) -> None:
            await super().attach_all_watchdogs()
            if public_web:
                from public_urls import public_security_watchdog
                original = self._security_watchdog
                for event_type in original.LISTENS_TO:
                    BaseWatchdog.detach_handler_from_session(self, event_type, getattr(original, "on_" + event_type.__name__))
                self._security_watchdog = public_security_watchdog(self)
                self._security_watchdog.attach_to_session()
            downloads = self._downloads_watchdog
            if downloads is not None:
                # 0.13.11 otherwise re-enables CDP downloads and downloads PDF responses via HTTP.
                for event_type in downloads.LISTENS_TO:
                    handler = getattr(downloads, "on_" + event_type.__name__, None)
                    if handler:
                        BaseWatchdog.detach_handler_from_session(self, event_type, handler)
                if any(getattr(handler, "__name__", "").startswith("DownloadsWatchdog.")
                       for handlers in self.event_bus.handlers.values() for handler in handlers):
                    raise RuntimeError("The pinned download policy no longer matches Browser Use.")
                self._downloads_watchdog = None

        async def on_BrowserStartEvent(self, event: BrowserStartEvent) -> dict[str, str]:
            result = await super().on_BrowserStartEvent(event)
            await self.cdp_client.send.Browser.setDownloadBehavior(params={"behavior": "deny", "eventsEnabled": True})
            return result

    return ReadOnlyBrowser(**{**options, "accept_downloads": False, "auto_download_pdfs": False})
