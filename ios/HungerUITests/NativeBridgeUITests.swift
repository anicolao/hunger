import XCTest

@MainActor
final class NativeBridgeUITests: XCTestCase {
    func testPackagedApplicationCompletesTheVersionedHandshake() {
        let app = XCUIApplication()
        defer { app.terminate() }
        app.launchArguments = ["--bridge-ui-test"]
        app.launch()

        XCTAssertTrue(
            app.descendants(matching: .any)
                .matching(NSPredicate(format: "label CONTAINS 'Native bridge ready'"))
                .firstMatch
                // A fresh CI simulator can spend more than 20 seconds launching
                // WebKit before the packaged application completes its handshake.
                .waitForExistence(timeout: 45)
        )
        XCTAssertTrue(app.webViews.firstMatch.exists)
    }

    func testSelectedDarkAppearanceCoversNativeSafeAreas() {
        let app = XCUIApplication()
        defer { app.terminate() }
        app.launchArguments = ["--reset-web-data"]
        app.launch()

        XCTAssertTrue(app.exactElement(label: "Choose your look").waitForExistence(timeout: 45))
        let darkChoice = app.exactElement(label: "Dark Deep and luminous")
        darkChoice.tapWhenReady()
        XCTAssertTrue(app.buttons["Use dark mode"].waitForExistence(timeout: 10))

        let window = app.windows.firstMatch
        let webView = app.webViews.firstMatch
        XCTAssertTrue(window.waitForExistence(timeout: 10))
        XCTAssertTrue(webView.waitForExistence(timeout: 10))
        XCTAssertEqual(webView.frame.minY, window.frame.minY, accuracy: 1)
        XCTAssertEqual(webView.frame.maxY, window.frame.maxY, accuracy: 1)

        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "dark-mode-safe-areas"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
