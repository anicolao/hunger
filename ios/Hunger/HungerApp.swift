import SwiftUI

@main
struct HungerApp: App {
    @StateObject private var controller = WebAppController()

    var body: some Scene {
        WindowGroup {
            WebAppView(controller: controller)
        }
    }
}
