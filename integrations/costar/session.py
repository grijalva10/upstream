"""CoStar Session Manager - Authentication with Cookie Persistence."""

import asyncio
import json
import logging
import os
import random
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from pydoll.browser import Chrome
from pydoll.browser.options import ChromiumOptions

load_dotenv()

logger = logging.getLogger(__name__)

LOGIN_URL = "https://product.costar.com/"
HOME_URLS = [
    "https://product.costar.com/home/",
    "https://product.costar.com/suiteapps/home"
]
LEASECOMPS_URL = "https://product.costar.com/LeaseComps/Search/Index/US"

FORM_TIMEOUT = 10
QR_TIMEOUT = 60  # 1 minute for QR scan
COOKIE_MAX_AGE_DAYS = 7


class CoStarSession:
    """Manages CoStar authentication and browser lifecycle."""

    def __init__(self, headless: bool = True):
        self.username = os.getenv('COSTAR_USERNAME')
        self.password = os.getenv('COSTAR_PW')

        if not self.username or not self.password:
            raise ValueError("COSTAR_USERNAME and COSTAR_PW environment variables required")

        self.headless = headless
        self.browser: Optional[Chrome] = None
        self.tab = None
        self._cookie_file = Path("session") / "costar_cookies.json"

    async def __aenter__(self):
        self._cookie_file.parent.mkdir(exist_ok=True)

        options = ChromiumOptions()
        if self.headless:
            options.add_argument("--headless=new")

        self.browser = Chrome(options=options)
        await self.browser.__aenter__()
        self.tab = await self.browser.start()

        if not await self._try_cookies() and not await self._login():
            raise Exception("CoStar authentication failed")

        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.browser:
            await self.browser.__aexit__(exc_type, exc_val, exc_tb)

    async def _try_cookies(self) -> bool:
        if not self._cookie_file.exists():
            return False

        try:
            with open(self._cookie_file) as f:
                data = json.load(f)

            if data.get('username') != self.username:
                logger.info("Cookie username mismatch")
                return False

            saved_at = datetime.fromisoformat(data['saved_at'])
            if datetime.now() - saved_at > timedelta(days=COOKIE_MAX_AGE_DAYS):
                logger.info("Cookies expired")
                return False

            from pydoll.protocol.network.types import CookieParam
            now = datetime.now().timestamp()
            cookies = [
                CookieParam(
                    name=c['name'],
                    value=c['value'],
                    domain=c.get('domain'),
                    path=c.get('path', '/'),
                    secure=c.get('secure', False),
                    httpOnly=c.get('httpOnly', False)
                )
                for c in data['cookies']
                if c.get('expires', -1) == -1 or c['expires'] >= now
            ]

            if not cookies:
                return False

            await self.browser.set_cookies(cookies)
            await self.tab.go_to(HOME_URLS[0])
            await asyncio.sleep(3)

            url = await self._get_url()
            if not any(home in url for home in HOME_URLS):
                logger.info("Cookie validation failed")
                self._cookie_file.unlink(missing_ok=True)
                return False

            logger.info("Session restored from cookies")
            await self._navigate_to_leasecomps()
            return True

        except Exception as e:
            logger.warning(f"Cookie restore failed: {e}")
            self._cookie_file.unlink(missing_ok=True)
            return False

    async def _login(self) -> bool:
        try:
            logger.info("Starting fresh login...")
            await self.tab.go_to(LOGIN_URL)

            form = await self.tab.find(id="signinform", timeout=FORM_TIMEOUT)
            if not form:
                raise Exception("Login form not found")

            await asyncio.sleep(1)
            await self._fill_field("username", self.username)
            await self._fill_field("password", self.password)

            button = await self.tab.find(id="loginButton", timeout=5)
            if not button:
                raise Exception("Login button not found")
            await button.click()

            logger.info("Waiting for QR code scan (up to 1 min)...")
            for elapsed in range(0, QR_TIMEOUT, 2):
                await asyncio.sleep(2)
                url = await self._get_url()
                if any(home in url for home in HOME_URLS):
                    logger.info("Login successful!")
                    await self._save_cookies()
                    await self._navigate_to_leasecomps()
                    return True
                if elapsed > 0 and elapsed % 30 == 0:
                    logger.info(f"Still waiting for QR scan... ({elapsed}s)")

            logger.error("QR code timeout")
            return False

        except Exception as e:
            logger.error(f"Login failed: {e}")
            return False

    async def _fill_field(self, field_id: str, value: str):
        field = await self.tab.find(id=field_id, timeout=5)
        if not field:
            raise Exception(f"Field {field_id} not found")

        # Focus and clear field
        await self.tab.execute_script(f"""
            var el = document.getElementById('{field_id}');
            el.focus();
            el.value = '';
        """)
        await asyncio.sleep(random.uniform(0.3, 0.5))

        # Type value with human-like speed
        await field.insert_text(value)
        await asyncio.sleep(random.uniform(0.3, 0.5))

        # Blur to trigger validation
        await self.tab.execute_script(f"document.getElementById('{field_id}').blur();")
        await asyncio.sleep(random.uniform(0.2, 0.3))

    async def _navigate_to_leasecomps(self):
        logger.info("Navigating to LeaseComps...")
        await self.tab.go_to(LEASECOMPS_URL)
        await asyncio.sleep(random.uniform(2, 4))

    async def _get_url(self) -> str:
        result = await self.tab.execute_script("return window.location.href;")
        if isinstance(result, dict):
            nested = result.get('result', {})
            if isinstance(nested, dict) and 'result' in nested:
                return nested['result'].get('value', str(nested))
            return str(nested)
        return str(result)

    async def _save_cookies(self):
        try:
            cookies = await self.browser.get_cookies()
            cookie_list = [
                {
                    'name': c.get('name'),
                    'value': c.get('value'),
                    'domain': c.get('domain'),
                    'path': c.get('path', '/'),
                    'secure': c.get('secure', False),
                    'httpOnly': c.get('httpOnly', False),
                    'expires': c.get('expires')
                }
                for c in cookies if isinstance(c, dict)
            ]

            data = {
                'cookies': cookie_list,
                'saved_at': datetime.now().isoformat(),
                'username': self.username
            }

            with open(self._cookie_file, 'w') as f:
                json.dump(data, f, indent=2, default=str)

            logger.info(f"Saved {len(cookie_list)} cookies")
        except Exception as e:
            logger.warning(f"Failed to save cookies: {e}")
