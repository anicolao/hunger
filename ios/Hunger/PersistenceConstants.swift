import Foundation

enum PersistenceConstants {
    static let scheme = "hunger-app"
    static let host = "app"
    static let rootURL = URL(string: "\(scheme)://\(host)/")!
    static let websiteDataStoreIdentifier = UUID(uuidString: "7A464D33-CB62-4B4B-98F7-F82C8E950A73")!
}
