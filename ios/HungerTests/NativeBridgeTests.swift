import Foundation
import XCTest
@testable import Hunger

final class NativeBridgeTests: XCTestCase {
    private let trusted = NativeBridgeSource(
        isMainFrame: true,
        scheme: "hunger-app",
        host: "app",
        port: 0
    )

    func testAcceptsOnlyTheExactCapabilityRequest() throws {
        let request = try NativeBridgeValidator.decode(body: [
            "version": 1,
            "id": "request-123",
            "command": "capabilities.get",
            "payload": [:]
        ], source: trusted)

        XCTAssertEqual(
            request,
            NativeBridgeRequest(id: "request-123", command: .capabilitiesGet)
        )
    }

    func testRejectsForeignAndSubframeSources() {
        let sources = [
            NativeBridgeSource(isMainFrame: false, scheme: "hunger-app", host: "app", port: 0),
            NativeBridgeSource(isMainFrame: true, scheme: "https", host: "app", port: 0),
            NativeBridgeSource(isMainFrame: true, scheme: "hunger-app", host: "other", port: 0),
            NativeBridgeSource(isMainFrame: true, scheme: "hunger-app", host: "app", port: 443)
        ]
        for source in sources {
            XCTAssertThrowsError(try NativeBridgeValidator.decode(body: validBody(), source: source)) {
                XCTAssertEqual($0 as? NativeBridgeValidationError, .invalidSource)
            }
        }
    }

    func testRejectsWrongVersionCommandPayloadAndUnknownFields() {
        assertRejected(changing: "version", to: 2, as: .wrongVersion)
        assertRejected(changing: "command", to: "events.read", as: .unknownCommand)
        assertRejected(changing: "payload", to: ["events": true], as: .invalidPayload)
        var unknown = validBody()
        unknown["extra"] = true
        XCTAssertThrowsError(try NativeBridgeValidator.decode(body: unknown, source: trusted)) {
            XCTAssertEqual($0 as? NativeBridgeValidationError, .invalidRequest)
        }
    }

    func testRejectsOversizedAndMalformedIdentifiers() {
        assertRejected(
            changing: "id",
            to: String(repeating: "a", count: NativeBridgeConstants.maximumRequestBytes),
            as: .requestTooLarge
        )
        for id in ["", "spaces are not allowed", String(repeating: "a", count: 65)] {
            assertRejected(changing: "id", to: id, as: .invalidRequest)
        }
    }

    private func validBody() -> [String: Any] {
        ["version": 1, "id": "request-123", "command": "capabilities.get", "payload": [:]]
    }

    private func assertRejected(
        changing key: String,
        to value: Any,
        as expected: NativeBridgeValidationError
    ) {
        var body = validBody()
        body[key] = value
        XCTAssertThrowsError(try NativeBridgeValidator.decode(body: body, source: trusted)) {
            XCTAssertEqual($0 as? NativeBridgeValidationError, expected)
        }
    }
}
