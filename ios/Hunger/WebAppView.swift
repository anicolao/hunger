import SwiftUI
import UIKit
import WebKit

struct WebAppView: View {
    @ObservedObject var controller: WebAppController

    private var canvas: Color {
        switch controller.appearance {
        case .dark:
            Color(red: 7 / 255, green: 25 / 255, blue: 23 / 255)
        case .light:
            Color(red: 247 / 255, green: 242 / 255, blue: 232 / 255)
        case nil:
            Color(uiColor: UIColor { traits in
                traits.userInterfaceStyle == .dark
                    ? UIColor(red: 7 / 255, green: 25 / 255, blue: 23 / 255, alpha: 1)
                    : UIColor(red: 247 / 255, green: 242 / 255, blue: 232 / 255, alpha: 1)
            })
        }
    }

    private var colorScheme: ColorScheme? {
        switch controller.appearance {
        case .dark: .dark
        case .light: .light
        case nil: nil
        }
    }

    var body: some View {
        ZStack {
            canvas.ignoresSafeArea()

            if let webView = controller.webView {
                WebViewContainer(webView: webView)
                    .ignoresSafeArea()
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
        .preferredColorScheme(colorScheme)
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
