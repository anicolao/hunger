import XCTest

@MainActor
final class OfflineEventPersistenceUITests: XCTestCase {
    func testProgramAndOpenEpisodeSurviveRelaunch() {
        let app = XCUIApplication()
        defer { app.terminate() }
        app.launchArguments = ["--reset-web-data"]
        app.launch()

        XCTAssertFalse(app.links["Begin the 30-day program"].waitForExistence(timeout: 2))
        app.completeOnboarding()

        app.links["Check in before eating"].tapWhenReady()
        XCTAssertTrue(element(label: "4, Early hunger", in: app).waitForExistence(timeout: 10))
        element(label: "4, Early hunger", in: app).tap()
        app.buttons["Save"].tap()
        XCTAssertTrue(element(label: "Finish your check-in", in: app).waitForExistence(timeout: 10))
        keepScreenshot(named: "phone-open-check-in", of: app)
        app.terminate()

        let relaunched = XCUIApplication()
        defer { relaunched.terminate() }
        relaunched.launch()
        XCTAssertTrue(element(label: "Today", in: relaunched).waitForExistence(timeout: 20))
        XCTAssertTrue(
            element(label: "Finish your check-in", in: relaunched).waitForExistence(timeout: 10)
        )
        XCTAssertTrue(
            relaunched.descendants(matching: .any)
                .matching(NSPredicate(format: "label CONTAINS 'began at 4'"))
                .firstMatch
                .waitForExistence(timeout: 10)
        )
        keepScreenshot(named: "phone-replayed-check-in", of: relaunched)
    }

    private func element(label: String, in app: XCUIApplication) -> XCUIElement {
        app.descendants(matching: .any)
            .matching(NSPredicate(format: "label == %@", label))
            .firstMatch
    }

    private func keepScreenshot(named name: String, of app: XCUIApplication) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
