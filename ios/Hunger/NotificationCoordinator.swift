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

struct ReminderWindow: Equatable {
    let name: String
    let hour: Int

    var identifier: String { "appetite.reminder.\(name)" }
}

enum NotificationSchedule {
    static let message = "Want to notice how your body feels?"
    static let windows = [
        "morning": 9,
        "midday": 13,
        "evening": 18
    ]

    static func plan(for values: [String]) throws -> [ReminderWindow] {
        guard !values.isEmpty,
              values.count <= windows.count,
              Set(values).count == values.count,
              values.allSatisfy({ windows[$0] != nil })
        else {
            throw NativeBridgeValidationError.invalidPayload
        }
        return values.sorted().map { ReminderWindow(name: $0, hour: windows[$0]!) }
    }

    static var identifiers: [String] {
        windows.keys.sorted().map { "appetite.reminder.\($0)" }
    }
}

@MainActor
protocol NotificationCoordinating: AnyObject {
    func authorizationStatus() async -> NotificationAuthorization
    func requestAuthorization() async throws -> NotificationAuthorization
    func replaceSchedule(windows: [String]) async throws -> Int
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

    func replaceSchedule(windows: [String]) async throws -> Int {
        let plan = try NotificationSchedule.plan(for: windows)
        center.removePendingNotificationRequests(withIdentifiers: NotificationSchedule.identifiers)
        center.removeDeliveredNotifications(withIdentifiers: NotificationSchedule.identifiers)
        for window in plan {
            let content = UNMutableNotificationContent()
            content.title = "Learn Your Appetite"
            content.body = NotificationSchedule.message
            content.sound = .default
            content.userInfo = ["route": "today"]
            let trigger = UNCalendarNotificationTrigger(
                dateMatching: DateComponents(hour: window.hour),
                repeats: true
            )
            try await center.add(UNNotificationRequest(
                identifier: window.identifier,
                content: content,
                trigger: trigger
            ))
        }
        return plan.count
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
    private(set) var status: NotificationAuthorization = .authorized

    func authorizationStatus() async -> NotificationAuthorization { status }
    func requestAuthorization() async throws -> NotificationAuthorization { status }
    func replaceSchedule(windows: [String]) async throws -> Int {
        let plan = try NotificationSchedule.plan(for: windows)
        scheduledIdentifiers = Set(plan.map(\.identifier))
        return scheduledIdentifiers.count
    }
    func cancelAll() async { scheduledIdentifiers.removeAll() }
}
#endif
