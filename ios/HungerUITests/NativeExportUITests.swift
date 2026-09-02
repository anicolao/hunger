import XCTest

@MainActor
final class NativeExportUITests: XCTestCase {
    func testPresentsAndCleansUpPrivateJsonExport() {
        let app = XCUIApplication()
        defer { app.terminate() }
        app.launchArguments = ["--reset-web-data"]
        app.launch()
        app.completeOnboarding()

        app.tapBottomNavigation(.profile)
        XCTAssertTrue(app.exactElement(label: "Your appetite profile").waitForExistence(timeout: 10))
        app.scrollToAndTap(app.buttons["Download JSON"])

        let shareSheet = app.otherElements["ActivityListView"]
        guard shareSheet.waitForExistence(timeout: 10) else {
            XCTFail("The native share sheet did not appear.")
            return
        }
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "phone-private-export-share-sheet"
        attachment.lifetime = .keepAlways
        add(attachment)

        let closeShareSheet = app.buttons.matching(
            NSPredicate(format: "label == 'Close'")
        ).firstMatch
        let dismissRegion = app.otherElements["PopoverDismissRegion"].firstMatch
        if closeShareSheet.waitForExistence(timeout: 2) {
            closeShareSheet.tap()
        } else if dismissRegion.exists {
            dismissRegion.tap()
        } else {
            shareSheet.swipeDown()
        }
        XCTAssertTrue(
            app.exactElement(label: "Private export closed and temporary file removed.")
                .waitForExistence(timeout: 10)
        )
    }
}
