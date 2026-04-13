from playwright.sync_api import sync_playwright
import time

def verify_dark_mode():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            color_scheme='dark'
        )
        page = context.new_page()

        print("Navigating to local server...")
        page.goto('http://localhost:5173/')

        page.evaluate("""() => {
            window.electronAPI = {
                store: {
                    get: () => ({}),
                    set: () => {}
                },
                getSettings: () => ({}),
                invoke: () => Promise.resolve({}),
                receive: () => {}
            };
        }""")

        page.evaluate("document.documentElement.setAttribute('data-mantine-color-scheme', 'dark')")

        time.sleep(3)
        page.screenshot(path='verification_dark3.png', full_page=True)
        print("Screenshot saved to verification_dark3.png")

        browser.close()

if __name__ == "__main__":
    verify_dark_mode()
