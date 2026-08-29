import Combine
import Foundation
import WebKit

enum WebAppState: Equatable {
    case idle
    case loading
    case ready
    case failed(String)
}

@MainActor
final class WebAppController: NSObject, ObservableObject {
    @Published private(set) var webView: WKWebView?
    @Published private(set) var state: WebAppState = .idle

    private var started = false
    private var bridge: NativeBridge?
    private var recoveryAttempts = 0
    private var lastSafeURL = PersistenceConstants.rootURL
    private let maximumRecoveryAttempts = 2

    func startIfNeeded() async {
        guard !started else { return }
        started = true
        await buildAndLoad(resetData: ProcessInfo.processInfo.arguments.contains("--reset-web-data"))
    }

    func retry() async {
        recoveryAttempts = 0
        webView = nil
        await buildAndLoad(resetData: false)
    }

    private func buildAndLoad(resetData: Bool) async {
        state = .loading
        do {
            if resetData {
                try await removePersistentDataStore()
            }
            let configuration = try await makeConfiguration()
            let webView = WKWebView(frame: .zero, configuration: configuration)
            webView.navigationDelegate = self
            webView.allowsLinkPreview = false
#if DEBUG
            webView.isInspectable = true
#else
            webView.isInspectable = false
#endif
            self.webView = webView
            webView.load(URLRequest(url: lastSafeURL, cachePolicy: .reloadIgnoringLocalCacheData))
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    private func makeConfiguration() async throws -> WKWebViewConfiguration {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = WKWebsiteDataStore(
            forIdentifier: PersistenceConstants.websiteDataStoreIdentifier
        )
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.setURLSchemeHandler(
            try OfflineAssetSchemeHandler(),
            forURLScheme: PersistenceConstants.scheme
        )

        let notifications: NotificationCoordinating
#if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--notification-ui-test") {
            notifications = InMemoryNotificationCoordinator()
        } else {
            notifications = NotificationCoordinator()
        }
#else
        notifications = NotificationCoordinator()
#endif
        let bridge = NativeBridge(
            notifications: notifications,
            uiTestEvidenceEnabled: ProcessInfo.processInfo.arguments.contains("--bridge-ui-test")
        )
        configuration.userContentController.addUserScript(NativeBridge.bootstrapScript)
        configuration.userContentController.addScriptMessageHandler(
            bridge,
            contentWorld: .page,
            name: NativeBridgeConstants.handlerName
        )
        self.bridge = bridge

        let rules = """
        [
          {"trigger":{"url-filter":"^https?://.*"},"action":{"type":"block"}},
          {"trigger":{"url-filter":"^wss?://.*"},"action":{"type":"block"}}
        ]
        """
        let ruleList = try await compileRuleList(rules)
        configuration.userContentController.add(ruleList)
        return configuration
    }

    func sendForegroundLifecycle() async {
        guard state == .ready, let webView, let bridge else { return }
        await bridge.sendLifecycle([
            "reason": "foreground",
            "occurredAt": Int(Date().timeIntervalSince1970 * 1000)
        ], to: webView)
    }

    private func compileRuleList(_ source: String) async throws -> WKContentRuleList {
        try await withCheckedThrowingContinuation {
            (continuation: CheckedContinuation<WKContentRuleList, Error>) in
            WKContentRuleListStore.default().compileContentRuleList(
                forIdentifier: "hunger-offline-network-block-v1",
                encodedContentRuleList: source
            ) { ruleList, error in
                if let ruleList {
                    continuation.resume(returning: ruleList)
                } else {
                    continuation.resume(throwing: error ?? OfflineAssetError.invalidManifest)
                }
            }
        }
    }

    private func removePersistentDataStore() async throws {
        webView = nil
        let dataStore = WKWebsiteDataStore(
            forIdentifier: PersistenceConstants.websiteDataStoreIdentifier
        )
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            dataStore.removeData(
                ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(),
                modifiedSince: .distantPast
            ) {
                continuation.resume(returning: ())
            }
        }
    }
}

extension WebAppController: WKNavigationDelegate {
    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction
    ) async -> WKNavigationActionPolicy {
        let decision = NavigationPolicy.decision(
            for: navigationAction.request.url,
            opensNewWindow: navigationAction.targetFrame == nil
        )
        return decision == .allow ? .allow : .cancel
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        if let url = webView.url,
           NavigationPolicy.decision(for: url, opensNewWindow: false) == .allow {
            lastSafeURL = url
        }
        recoveryAttempts = 0
        state = .ready
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: any Error
    ) {
        state = .failed(error.localizedDescription)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        guard recoveryAttempts < maximumRecoveryAttempts else {
            state = .failed("The app's web content stopped repeatedly. Your saved records were not cleared.")
            return
        }
        recoveryAttempts += 1
        state = .loading
        webView.load(URLRequest(url: lastSafeURL, cachePolicy: .reloadIgnoringLocalCacheData))
    }
}
