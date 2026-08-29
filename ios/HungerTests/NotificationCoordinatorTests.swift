import UserNotifications
import XCTest
@testable import Hunger

final class NotificationCoordinatorTests: XCTestCase {
    func testBuildsStablePrivateReminderWindows() throws {
        XCTAssertEqual(
            try NotificationSchedule.plan(for: ["evening", "morning"]),
            [
                ReminderWindow(name: "evening", hour: 18),
                ReminderWindow(name: "morning", hour: 9)
            ]
        )
        XCTAssertEqual(
            NotificationSchedule.identifiers,
            [
                "appetite.reminder.evening",
                "appetite.reminder.midday",
                "appetite.reminder.morning"
            ]
        )
        XCTAssertEqual(NotificationSchedule.message, "Want to notice how your body feels?")
    }

    func testRejectsUnknownDuplicateAndEmptyWindows() {
        XCTAssertThrowsError(try NotificationSchedule.plan(for: []))
        XCTAssertThrowsError(try NotificationSchedule.plan(for: ["night"]))
        XCTAssertThrowsError(try NotificationSchedule.plan(for: ["morning", "morning"]))
    }

    func testMapsEveryKnownAuthorizationState() {
        XCTAssertEqual(NotificationCoordinator.map(.notDetermined), .notDetermined)
        XCTAssertEqual(NotificationCoordinator.map(.denied), .denied)
        XCTAssertEqual(NotificationCoordinator.map(.authorized), .authorized)
        XCTAssertEqual(NotificationCoordinator.map(.provisional), .provisional)
        XCTAssertEqual(NotificationCoordinator.map(.ephemeral), .ephemeral)
    }
}
