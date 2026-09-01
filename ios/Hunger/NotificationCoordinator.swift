import Foundation
@preconcurrency import UserNotifications

enum NotificationAuthorization: String, Equatable, Sendable {
    case notDetermined = "not_determined"
    case denied
    case authorized
    case provisional
    case ephemeral
    case unknown
}

struct ReminderScheduleItem: Equatable {
    let identifier: String
    let kind: String
    let hour: Int?
    let fireAt: Int64?
    let repeatsDaily: Bool
}

struct ReminderSchedule: Equatable {
    let version: Int
    let message: String
    let items: [ReminderScheduleItem]
}

enum NotificationSchedule {
    static let message = "Want to notice how your body feels?"
    static let windowHours = [
        "morning": 9,
        "midday": 13,
        "evening": 18
    ]

    static var identifiers: [String] {
        windowHours.keys.map { "appetite.reminder.\($0)" } + [
            "appetite.reminder.pending-completion",
            "appetite.reminder.context",
            "appetite.reminder.experiment"
        ]
    }
}

@MainActor
protocol NotificationCoordinating: AnyObject {
    func authorizationStatus() async -> NotificationAuthorization
    func requestAuthorization() async throws -> NotificationAuthorization
    func replaceSchedule(_ schedule: ReminderSchedule) async throws -> Int
    func cancelAll() async
}

@MainActor
final class NotificationCoordinator: NotificationCoordinating {
    private let center: UNUserNotificationCenter

    init(center: UNUserNotificationCenter = .current()) {
        self.center = center
    }

    func authorizationStatus() async -> NotificationAuthorization {
        await withCheckedContinuation { continuation in
            center.getNotificationSettings { settings in
                continuation.resume(returning: Self.map(settings.authorizationStatus))
            }
        }
    }

    func requestAuthorization() async throws -> NotificationAuthorization {
        _ = try await center.requestAuthorization(options: [.alert, .sound])
        return await authorizationStatus()
    }

    func replaceSchedule(_ schedule: ReminderSchedule) async throws -> Int {
        center.removePendingNotificationRequests(withIdentifiers: NotificationSchedule.identifiers)
        center.removeDeliveredNotifications(withIdentifiers: NotificationSchedule.identifiers)
        do {
            for item in schedule.items {
                let content = UNMutableNotificationContent()
                content.title = "Learn Your Appetite"
                content.body = schedule.message
                content.sound = .default
                content.userInfo = ["route": "today", "kind": item.kind]
                let trigger: UNNotificationTrigger
                if item.repeatsDaily, let hour = item.hour {
                    trigger = UNCalendarNotificationTrigger(
                        dateMatching: DateComponents(hour: hour),
                        repeats: true
                    )
                } else if let fireAt = item.fireAt {
                    let date = Date(timeIntervalSince1970: TimeInterval(fireAt) / 1_000)
                    trigger = UNCalendarNotificationTrigger(
                        dateMatching: Calendar.current.dateComponents(
                            [.year, .month, .day, .hour, .minute, .second],
                            from: date
                        ),
                        repeats: false
                    )
                } else {
                    throw NativeBridgeValidationError.invalidPayload
                }
                try await center.add(UNNotificationRequest(
                    identifier: item.identifier,
                    content: content,
                    trigger: trigger
                ))
            }
        } catch {
            center.removePendingNotificationRequests(withIdentifiers: NotificationSchedule.identifiers)
            throw error
        }
        return schedule.items.count
    }

    func cancelAll() async {
        center.removePendingNotificationRequests(withIdentifiers: NotificationSchedule.identifiers)
        center.removeDeliveredNotifications(withIdentifiers: NotificationSchedule.identifiers)
    }

    nonisolated static func map(_ status: UNAuthorizationStatus) -> NotificationAuthorization {
        switch status {
        case .notDetermined: .notDetermined
        case .denied: .denied
        case .authorized: .authorized
        case .provisional: .provisional
        case .ephemeral: .ephemeral
        @unknown default: .unknown
        }
    }
}

#if DEBUG
@MainActor
final class InMemoryNotificationCoordinator: NotificationCoordinating {
    private(set) var scheduledIdentifiers: Set<String> = []
    private(set) var status: NotificationAuthorization = .notDetermined

    func authorizationStatus() async -> NotificationAuthorization { status }
    func requestAuthorization() async throws -> NotificationAuthorization {
        status = .authorized
        return status
    }
    func replaceSchedule(_ schedule: ReminderSchedule) async throws -> Int {
        scheduledIdentifiers = Set(schedule.items.map(\.identifier))
        return scheduledIdentifiers.count
    }
    func cancelAll() async { scheduledIdentifiers.removeAll() }
}
#endif
