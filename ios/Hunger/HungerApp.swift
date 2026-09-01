import SwiftUI
@preconcurrency import UserNotifications

final class HungerAppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }

    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let userInfo = response.notification.request.content.userInfo
        await MainActor.run {
            NotificationRouteCenter.shared.receive(userInfo: userInfo)
        }
    }
}

@main
struct HungerApp: App {
    @UIApplicationDelegateAdaptor(HungerAppDelegate.self) private var appDelegate
    @StateObject private var controller = WebAppController()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            WebAppView(controller: controller)
        }
        .onChange(of: scenePhase) { _, phase in
            guard phase == .active else { return }
            Task { await controller.sendForegroundLifecycle() }
        }
    }
}
