import Foundation

enum NavigationDecision: Equatable {
    case allow
    case cancel
}

enum NavigationPolicy {
    static func decision(for url: URL?, opensNewWindow: Bool) -> NavigationDecision {
        guard !opensNewWindow,
              let url,
              url.scheme?.lowercased() == PersistenceConstants.scheme,
              url.host?.lowercased() == PersistenceConstants.host,
              url.user == nil,
              url.password == nil,
              url.port == nil
        else {
            return .cancel
        }
        return .allow
    }
}
