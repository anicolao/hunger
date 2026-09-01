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
                .waitForExistence(timeout: 20)
        )
        XCTAssertTrue(app.webViews.firstMatch.exists)
    }
}
