import Foundation
import XCTest
@testable import Hunger

final class OfflineAssetTests: XCTestCase {
    private let paths: Set<String> = [
        "index.html",
        "settings.html",
        "check-in/new.html",
        "_app/immutable/start.js"
    ]

    func testMapsPrerenderedRoutesAndAssets() throws {
        XCTAssertEqual(
            try OfflineAssetSchemeHandler.assetPath(
                for: URL(string: "hunger-app://app/")!,
                availablePaths: paths
            ),
            "index.html"
        )
        XCTAssertEqual(
            try OfflineAssetSchemeHandler.assetPath(
                for: URL(string: "hunger-app://app/check-in/new?from=today")!,
                availablePaths: paths
            ),
            "check-in/new.html"
        )
        XCTAssertEqual(
            try OfflineAssetSchemeHandler.assetPath(
                for: URL(string: "hunger-app://app/_app/immutable/start.js")!,
                availablePaths: paths
            ),
            "_app/immutable/start.js"
        )
    }

    func testRejectsForeignOriginsAndTraversal() {
        let invalidURLs = [
            "https://app/settings",
            "hunger-app://other/settings",
            "hunger-app://app/%2e%2e/settings",
            "hunger-app://app/%252e%252e/settings",
            "hunger-app://user@app/settings",
            "hunger-app://app:80/settings"
        ]
        for value in invalidURLs {
            XCTAssertThrowsError(
                try OfflineAssetSchemeHandler.assetPath(
                    for: URL(string: value)!,
                    availablePaths: paths
                ),
                value
            )
        }
    }

    func testNavigationAllowsOnlyTheBundledOrigin() {
        XCTAssertEqual(
            NavigationPolicy.decision(
                for: URL(string: "hunger-app://app/settings"),
                opensNewWindow: false
            ),
            .allow
        )
        XCTAssertEqual(
            NavigationPolicy.decision(
                for: URL(string: "https://example.com"),
                opensNewWindow: false
            ),
            .cancel
        )
        XCTAssertEqual(
            NavigationPolicy.decision(
                for: URL(string: "hunger-app://app/settings"),
                opensNewWindow: true
            ),
            .cancel
        )
    }

    func testPersistenceIdentifiersAreReleaseConstants() {
        XCTAssertEqual(PersistenceConstants.scheme, "hunger-app")
        XCTAssertEqual(PersistenceConstants.host, "app")
        XCTAssertEqual(
            PersistenceConstants.websiteDataStoreIdentifier.uuidString,
            "7A464D33-CB62-4B4B-98F7-F82C8E950A73"
        )
    }
}
