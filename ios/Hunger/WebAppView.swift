import SwiftUI
import WebKit

struct WebAppView: View {
    @ObservedObject var controller: WebAppController

    var body: some View {
        ZStack {
            Color(red: 0.969, green: 0.957, blue: 0.933)
                .ignoresSafeArea()

            if let webView = controller.webView {
                WebViewContainer(webView: webView)
                    .ignoresSafeArea(.container, edges: .bottom)
            } else if case let .failed(message) = controller.state {
                ContentUnavailableView {
                    Label("Learn Your Appetite could not open", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(message)
                } actions: {
                    Button("Try Again") {
                        Task { await controller.retry() }
                    }
                }
                .padding()
            } else {
                ProgressView("Opening Learn Your Appetite")
                    .accessibilityIdentifier("native-loading")
            }
        }
        .task {
            await controller.startIfNeeded()
        }
    }
}

private struct WebViewContainer: UIViewRepresentable {
    let webView: WKWebView

    func makeUIView(context: Context) -> WKWebView {
        webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
