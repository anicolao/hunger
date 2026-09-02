import XCTest

@MainActor
final class NativePrivacyAndRecoveryUITests: XCTestCase {
    func testDeleteEverythingRecreatesAFirstRunOfflineShell() {
        let app = XCUIApplication()
        defer { app.terminate() }
        app.launchArguments = ["--reset-web-data", "--notification-ui-test"]
        app.launch()
        guard app.completeOnboarding() else { return }

        app.tapBottomNavigation(.settings)
        XCTAssertTrue(app.exactElement(label: "Appearance").waitForExistence(timeout: 10))
        app.exactElement(label: "Your data").tapWhenReady()
        let openDeleteConfirmation = app.buttons["Delete everything"]
        app.scrollToAndTap(openDeleteConfirmation)

        XCTAssertTrue(
            app.exactElement(label: "Delete everything on this device?")
                .waitForExistence(timeout: 10)
        )
        app.exactElement(label: "I understand this cannot be undone").tapWhenReady()
        app.buttons.matching(
            NSPredicate(format: "label == 'Delete everything' AND isEnabled == true")
        ).firstMatch.tapWhenReady()

        XCTAssertTrue(app.exactElement(label: "Choose your look").waitForExistence(timeout: 20))
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = "phone-private-deletion-first-run"
        attachment.lifetime = .keepAlways
        add(attachment)

        app.terminate()
        let relaunched = XCUIApplication()
        defer { relaunched.terminate() }
        relaunched.launch()
        XCTAssertTrue(
            relaunched.exactElement(label: "Choose your look").waitForExistence(timeout: 20)
        )
        let relaunchAttachment = XCTAttachment(screenshot: relaunched.screenshot())
        relaunchAttachment.name = "phone-private-deletion-relaunch"
        relaunchAttachment.lifetime = .keepAlways
        add(relaunchAttachment)
    }

}
