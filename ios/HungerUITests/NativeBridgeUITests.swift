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
}
