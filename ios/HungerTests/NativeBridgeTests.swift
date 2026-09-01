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
            NativeBridgeRequest(id: "request-123", command: .capabilitiesGet, payload: .empty)
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

    func testAcceptsOnlyAValidatedVersionedReminderSchedule() throws {
        let schedule: [String: Any] = [
            "version": 1,
            "message": NotificationSchedule.message,
            "items": [[
                "identifier": "appetite.reminder.morning",
                "kind": "window",
                "hour": 9,
                "repeatsDaily": true
            ]]
        ]
        let request = try NativeBridgeValidator.decode(body: [
            "version": 1,
            "id": "reminder-1",
            "command": "notifications.replaceSchedule",
            "payload": ["schedule": schedule]
        ], source: trusted)
        XCTAssertEqual(
            request.payload,
            .reminderSchedule(ReminderSchedule(
                version: 1,
                message: NotificationSchedule.message,
                items: [ReminderScheduleItem(
                    identifier: "appetite.reminder.morning",
                    kind: "window",
                    hour: 9,
                    fireAt: nil,
                    repeatsDaily: true
                )]
            ))
        )

        for item in [
            ["identifier": "appetite.reminder.night", "kind": "window", "hour": 21, "repeatsDaily": true] as [String: Any],
            ["identifier": "appetite.reminder.morning", "kind": "window", "hour": 18, "repeatsDaily": true] as [String: Any],
            ["identifier": "appetite.reminder.pending-completion", "kind": "pending-completion", "fireAt": 0, "repeatsDaily": false] as [String: Any]
        ] {
            var body = validBody()
            body["command"] = "notifications.replaceSchedule"
            body["payload"] = ["schedule": [
                "version": 1,
                "message": NotificationSchedule.message,
                "items": [item]
            ]]
            XCTAssertThrowsError(try NativeBridgeValidator.decode(body: body, source: trusted))
        }
    }

    func testAcceptsOnlyAuditedPrivateExportPayloads() throws {
        let request = try NativeBridgeValidator.decode(body: [
            "version": 1,
            "id": "export-1",
            "command": "export.share",
            "payload": [
                "filename": "appetite-profile.json",
                "mimeType": "application/json",
                "content": "{\"exportVersion\":1}"
            ]
        ], source: trusted)
        XCTAssertEqual(
            request.payload,
            .export(ValidatedExport(
                filename: "appetite-profile.json",
                mimeType: "application/json",
                content: "{\"exportVersion\":1}"
            ))
        )
    }

    func testAcceptsOnlyAnEmptyPrivateDeletionPayload() throws {
        var body = validBody()
        body["command"] = "privacy.completeDelete"
        let request = try NativeBridgeValidator.decode(body: body, source: trusted)
        XCTAssertEqual(request.command, .privacyCompleteDelete)
        XCTAssertEqual(request.payload, .empty)

        body["payload"] = ["database": "learn-your-appetite"]
        XCTAssertThrowsError(try NativeBridgeValidator.decode(body: body, source: trusted)) {
            XCTAssertEqual($0 as? NativeBridgeValidationError, .invalidPayload)
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
