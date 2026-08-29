import SwiftUI

@main
struct HungerApp: App {
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
