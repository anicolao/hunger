import XCTest

@MainActor
final class NativePrivacyAndRecoveryUITests: XCTestCase {
    func testDeleteEverythingRecreatesAFirstRunOfflineShell() {
        let app = XCUIApplication()
        app.launchArguments = ["--reset-web-data", "--notification-ui-test"]
        app.launch()
        completeOnboarding(in: app)

        XCTAssertTrue(element(label: "Today", in: app).waitForExistence(timeout: 20))
        app.links["Settings"].tap()
        XCTAssertTrue(element(label: "PRIVATE ON THIS DEVICE", in: app).waitForExistence(timeout: 10))
        let openDeleteConfirmation = app.buttons["Delete everything"]
        for _ in 0..<4 where !openDeleteConfirmation.exists {
            app.swipeUp()
        }
        openDeleteConfirmation.tap()

        XCTAssertTrue(
            element(label: "Delete everything on this device?", in: app)
                .waitForExistence(timeout: 10)
        )
        element(label: "I understand this cannot be undone", in: app).tap()
        app.buttons.matching(
            NSPredicate(format: "label == 'Delete everything' AND isEnabled == true")
        ).firstMatch.tap()

        XCTAssertTrue(element(label: "Learn your appetite.", in: app).waitForExistence(timeout: 20))
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "phone-private-deletion-first-run"
        attachment.lifetime = .keepAlways
        add(attachment)

        app.terminate()
        let relaunched = XCUIApplication()
        relaunched.launch()
        XCTAssertTrue(
            element(label: "Learn your appetite.", in: relaunched).waitForExistence(timeout: 20)
        )
        let relaunchAttachment = XCTAttachment(screenshot: relaunched.screenshot())
        relaunchAttachment.name = "phone-private-deletion-relaunch"
        relaunchAttachment.lifetime = .keepAlways
        add(relaunchAttachment)
    }

    private func completeOnboarding(in app: XCUIApplication) {
        XCTAssertTrue(element(label: "Learn your appetite.", in: app).waitForExistence(timeout: 20))
        app.swipeUp()
        app.links["Begin the 30-day program"].tap()
        XCTAssertTrue(app.buttons["Begin"].waitForExistence(timeout: 10))
        app.buttons["Begin"].tap()
        let clearHunger = element(label: "3, Clear hunger", in: app)
        XCTAssertTrue(clearHunger.waitForExistence(timeout: 10))
        clearHunger.tap()
        app.buttons["I understand"].tap()
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
