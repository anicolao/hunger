import XCTest

@MainActor
final class NativePrivacyAndRecoveryUITests: XCTestCase {
    func testDeleteEverythingRecreatesAFirstRunOfflineShell() {
        let app = XCUIApplication()
        defer { app.terminate() }
        app.launchArguments = ["--reset-web-data", "--notification-ui-test"]
        app.launch()
        completeOnboarding(in: app)

        XCTAssertTrue(element(label: "Today", in: app).waitForExistence(timeout: 20))
        app.links["Settings"].tap()
        XCTAssertTrue(element(label: "Appearance", in: app).waitForExistence(timeout: 10))
        element(label: "Your data", in: app).tap()
        let openDeleteConfirmation = app.buttons["Delete everything"]
        XCTAssertTrue(openDeleteConfirmation.waitForExistence(timeout: 10))
        // Move the destructive action clear of the floating tab bar. WebKit can
        // report an element under that bar as hittable even though the bar wins
        // the tap at the same coordinate.
        app.swipeUp()
        app.swipeUp()
        XCTAssertTrue(openDeleteConfirmation.isHittable)
        openDeleteConfirmation.tap()

        XCTAssertTrue(
            element(label: "Delete everything on this device?", in: app)
                .waitForExistence(timeout: 10)
        )
        element(label: "I understand this cannot be undone", in: app).tap()
        app.buttons.matching(
            NSPredicate(format: "label == 'Delete everything' AND isEnabled == true")
        ).firstMatch.tap()

        XCTAssertTrue(element(label: "Choose your look", in: app).waitForExistence(timeout: 20))
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "phone-private-deletion-first-run"
        attachment.lifetime = .keepAlways
        add(attachment)

        app.terminate()
        let relaunched = XCUIApplication()
        defer { relaunched.terminate() }
        relaunched.launch()
        XCTAssertTrue(
            element(label: "Choose your look", in: relaunched).waitForExistence(timeout: 20)
        )
        let relaunchAttachment = XCTAttachment(screenshot: relaunched.screenshot())
        relaunchAttachment.name = "phone-private-deletion-relaunch"
        relaunchAttachment.lifetime = .keepAlways
        add(relaunchAttachment)
    }

    private func completeOnboarding(in app: XCUIApplication) {
        XCTAssertTrue(element(label: "Choose your look", in: app).waitForExistence(timeout: 20))
        app.buttons["Use light mode"].tap()
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
