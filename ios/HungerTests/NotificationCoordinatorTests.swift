import UserNotifications
import XCTest
@testable import Hunger

final class NotificationCoordinatorTests: XCTestCase {
    func testOwnsEveryStablePrivateReminderIdentifier() {
        XCTAssertEqual(Set(NotificationSchedule.identifiers), Set([
            "appetite.reminder.evening",
            "appetite.reminder.midday",
            "appetite.reminder.morning",
            "appetite.reminder.pending-completion",
            "appetite.reminder.context",
            "appetite.reminder.experiment"
        ]))
        XCTAssertEqual(NotificationSchedule.message, "Want to notice how your body feels?")
    }

    func testMapsEveryKnownAuthorizationState() {
        XCTAssertEqual(NotificationCoordinator.map(.notDetermined), .notDetermined)
        XCTAssertEqual(NotificationCoordinator.map(.denied), .denied)
        XCTAssertEqual(NotificationCoordinator.map(.authorized), .authorized)
        XCTAssertEqual(NotificationCoordinator.map(.provisional), .provisional)
        XCTAssertEqual(NotificationCoordinator.map(.ephemeral), .ephemeral)
    }
}
