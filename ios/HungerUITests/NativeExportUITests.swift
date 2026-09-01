import XCTest

@MainActor
final class NativeExportUITests: XCTestCase {
    func testPresentsAndCleansUpPrivateJsonExport() {
        let app = XCUIApplication()
        defer { app.terminate() }
        app.launchArguments = ["--reset-web-data"]
        app.launch()
        completeOnboarding(in: app)

        XCTAssertTrue(element(label: "Today", in: app).waitForExistence(timeout: 20))
        app.tapBottomNavigation(.profile)
        XCTAssertTrue(element(label: "Your appetite profile", in: app).waitForExistence(timeout: 10))
        app.swipeUp()
        app.swipeUp()
        app.buttons["Download JSON"].tap()

        let shareSheet = app.otherElements["ActivityListView"]
        XCTAssertTrue(shareSheet.waitForExistence(timeout: 10))
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "phone-private-export-share-sheet"
        attachment.lifetime = .keepAlways
        add(attachment)

        let closeShareSheet = app.buttons.matching(
            NSPredicate(format: "label == 'Close'")
        ).firstMatch
        if closeShareSheet.waitForExistence(timeout: 2) {
            closeShareSheet.tap()
        } else if app.otherElements["PopoverDismissRegion"].exists {
            app.otherElements["PopoverDismissRegion"].tap()
        } else {
            shareSheet.swipeDown()
        }
        XCTAssertTrue(
            element(label: "Private export closed and temporary file removed.", in: app)
                .waitForExistence(timeout: 10)
        )
    }

    private func completeOnboarding(in app: XCUIApplication) {
        // A reset performs a full WKWebsiteDataStore purge before reloading the
        // packaged shell. Loaded CI simulators can take longer than the normal
        // navigation timeout to finish that cold start.
        XCTAssertTrue(element(label: "Learn your appetite.", in: app).waitForExistence(timeout: 45))
        app.swipeUp()
        app.links["Begin the 30-day program"].tap()
        XCTAssertTrue(app.buttons["Begin"].waitForExistence(timeout: 10))
        app.buttons["Begin"].tap()
        XCTAssertTrue(
            element(label: "Practice only—not a check-in.", in: app)
                .waitForExistence(timeout: 10)
        )
        app.buttons["Continue"].tap()
        XCTAssertTrue(
            element(label: "Small moments become patterns", in: app)
                .waitForExistence(timeout: 10)
        )
        app.buttons["Continue"].tap()
        element(label: "Not now", in: app).tap()
        app.buttons["Start day 1"].tap()
    }

    private func element(label: String, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any)
            .matching(NSPredicate(format: "label == %@", label))
            .firstMatch
    }
}
