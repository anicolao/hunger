import XCTest

@MainActor
final class NativeReminderUITests: XCTestCase {
    func testSchedulesAndCancelsPrivateReminderFromSettings() {
        let app = XCUIApplication()
        app.launchArguments = ["--reset-web-data", "--notification-ui-test"]
        app.launch()
        completeOnboarding(in: app)

        XCTAssertTrue(element(label: "Today", in: app).waitForExistence(timeout: 20))
        app.links["Settings"].tap()
        XCTAssertTrue(element(label: "Settings", in: app).waitForExistence(timeout: 10))

        element(label: "Morning", in: app).tap()
        app.buttons["Use in-app reminders"].tap()
        XCTAssertTrue(
            element(label: "Scheduled 1 private iOS reminder.", in: app)
                .waitForExistence(timeout: 10)
        )

        element(label: "Pause reminders", in: app).tap()
        XCTAssertTrue(
            element(label: "Private iOS reminders are paused.", in: app)
                .waitForExistence(timeout: 10)
        )
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "phone-native-reminders-paused"
        attachment.lifetime = .keepAlways
        add(attachment)
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
