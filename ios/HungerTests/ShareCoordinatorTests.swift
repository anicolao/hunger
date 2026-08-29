import XCTest
@testable import Hunger

final class ShareCoordinatorTests: XCTestCase {
    func testAcceptsOnlyAuditedExportPairs() throws {
        XCTAssertEqual(
            try ExportValidator.validate(
                filename: "appetite-profile.json",
                mimeType: "application/json",
                content: "{\"exportVersion\":1}"
            ).filename,
            "appetite-profile.json"
        )
        XCTAssertNoThrow(try ExportValidator.validate(
            filename: "appetite-profile.html",
            mimeType: "text/html",
            content: "<!doctype html>"
        ))
    }

    func testRejectsPathsTypesAndOversizedContent() {
        XCTAssertThrowsError(try ExportValidator.validate(
            filename: "../appetite-profile.json",
            mimeType: "application/json",
            content: "{}"
        ))
        XCTAssertThrowsError(try ExportValidator.validate(
            filename: "appetite-profile.json",
            mimeType: "text/html",
            content: "{}"
        ))
        XCTAssertThrowsError(try ExportValidator.validate(
            filename: "appetite-profile.json",
            mimeType: "application/json",
            content: String(repeating: "x", count: ExportValidator.maximumBytes + 1)
        ))
    }
}
