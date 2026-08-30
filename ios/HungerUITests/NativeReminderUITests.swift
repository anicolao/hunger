import XCTest

@MainActor
final class NativeReminderUITests: XCTestCase {
    func testSchedulesDuringOnboardingAndCancelsFromSettings() {
        let app = XCUIApplication()
        app.launchArguments = ["--reset-web-data", "--notification-ui-test"]
        app.launch()
        completeOnboarding(in: app)

        XCTAssertTrue(element(label: "Today", in: app).waitForExistence(timeout: 20))
        XCTAssertFalse(element(labelPrefix: "Build ", in: app).exists)
        app.tapBottomNavigation(.settings)
        XCTAssertTrue(element(label: "Settings", in: app).waitForExistence(timeout: 10))

        let build = element(labelPrefix: "Build ", in: app)
        XCTAssertTrue(build.waitForExistence(timeout: 10))
        XCTAssertNotNil(
            build.label.range(
                of: #"^Build [0-9a-f]{8}$"#,
                options: .regularExpression
            ),
            "The packaged Settings screen must expose the source commit, not a placeholder."
        )

        XCTAssertTrue(element(label: "Morning, on", in: app).waitForExistence(timeout: 10))

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
        element(label: "Set up reminders", in: app).tap()
        let morning = element(label: "Morning, off", in: app)
        XCTAssertTrue(morning.waitForExistence(timeout: 10))
        morning.tap()
        XCTAssertTrue(element(label: "Morning, on", in: app).waitForExistence(timeout: 10))
        app.buttons["Allow reminders and start"].tap()
    }

    private func element(label: String, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any)
            .matching(NSPredicate(format: "label == %@", label))
            .firstMatch
    }

    private func element(labelPrefix: String, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any)
            .matching(NSPredicate(format: "label BEGINSWITH %@", labelPrefix))
            .firstMatch
    }
}
