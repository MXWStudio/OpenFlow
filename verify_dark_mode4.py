import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        try:
            await page.goto("http://localhost:5173", timeout=10000)
            await page.wait_for_timeout(2000)

            # Switch to dark mode
            await page.evaluate("""() => {
                document.documentElement.setAttribute('data-mantine-color-scheme', 'dark');
            }""")
            await page.wait_for_timeout(1000)

            # Take full screenshot
            await page.screenshot(path="verification_dark2.png", full_page=True)
            print("Successfully took screenshot of dark mode.")

        except Exception as e:
            print(f"Error occurred: {e}")

        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
