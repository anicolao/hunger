import XCTest

@MainActor
final class NativeReminderUITests: XCTestCase {
    func testSchedulesDuringOnboardingAndCancelsFromSettings() {
        let app = XCUIApplication()
        defer { app.terminate() }
        app.launchArguments = ["--reset-web-data", "--notification-ui-test"]
        app.launch()
        app.completeOnboarding(reminders: true)

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

        element(label: "Reminders", in: app).tap()
        XCTAssertTrue(element(label: "Morning, on", in: app).waitForExistence(timeout: 10))
        XCTAssertTrue(element(label: "iOS has 1 private reminder pending.", in: app).waitForExistence(timeout: 10))

        element(label: "Pause reminders", in: app).tap()
        XCTAssertTrue(
            element(label: "Private iOS reminders are paused.", in: app)
                .waitForExistence(timeout: 10)
        )
        XCTAssertTrue(element(label: "iOS has 0 private reminders pending.", in: app).waitForExistence(timeout: 10))
        element(label: "Resume reminders", in: app).tap()
        XCTAssertTrue(element(label: "iOS has 1 private reminder pending.", in: app).waitForExistence(timeout: 10))
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "phone-native-reminders-paused"
        attachment.lifetime = .keepAlways
        add(attachment)
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
