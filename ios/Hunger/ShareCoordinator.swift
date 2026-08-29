import Foundation
import UIKit

struct ValidatedExport: Equatable {
    let filename: String
    let mimeType: String
    let content: String
}

enum ExportValidationError: String, Error, Equatable {
    case invalidFilename = "invalid_filename"
    case invalidMediaType = "invalid_media_type"
    case contentTooLarge = "content_too_large"
}

enum ExportValidator {
    static let maximumBytes = 2 * 1024 * 1024
    static let formats = [
        "appetite-profile.json": "application/json",
        "appetite-profile.html": "text/html"
    ]

    static func validate(
        filename: String,
        mimeType: String,
        content: String
    ) throws -> ValidatedExport {
        guard filename == (filename as NSString).lastPathComponent,
              let expectedType = formats[filename]
        else {
            throw ExportValidationError.invalidFilename
        }
        guard mimeType == expectedType else {
            throw ExportValidationError.invalidMediaType
        }
        guard content.lengthOfBytes(using: .utf8) <= maximumBytes else {
            throw ExportValidationError.contentTooLarge
        }
        return ValidatedExport(filename: filename, mimeType: mimeType, content: content)
    }
}

@MainActor
protocol ShareCoordinating: AnyObject {
    func share(_ export: ValidatedExport) async throws
    func removeTemporaryExports() throws
}

@MainActor
final class ShareCoordinator: ShareCoordinating {
    private let fileManager: FileManager
    private let directory: URL

    init(fileManager: FileManager = .default) {
        self.fileManager = fileManager
        directory = fileManager.temporaryDirectory.appendingPathComponent(
            "LearnYourAppetiteExports",
            isDirectory: true
        )
        try? removeTemporaryExports()
    }

    func share(_ export: ValidatedExport) async throws {
        try removeTemporaryExports()
        try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        let url = directory.appendingPathComponent(export.filename, isDirectory: false)
        try Data(export.content.utf8).write(to: url, options: [.atomic, .completeFileProtection])
        guard let presenter = Self.presenter() else {
            try? removeTemporaryExports()
            throw CocoaError(.fileNoSuchFile)
        }

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            let activity = UIActivityViewController(activityItems: [url], applicationActivities: nil)
            if let popover = activity.popoverPresentationController {
                popover.sourceView = presenter.view
                popover.sourceRect = CGRect(
                    x: presenter.view.bounds.midX,
                    y: presenter.view.bounds.midY,
                    width: 1,
                    height: 1
                )
            }
            activity.completionWithItemsHandler = { [weak self] _, _, _, _ in
                try? self?.removeTemporaryExports()
                continuation.resume(returning: ())
            }
            presenter.present(activity, animated: true)
        }
    }

    func removeTemporaryExports() throws {
        guard fileManager.fileExists(atPath: directory.path) else { return }
        try fileManager.removeItem(at: directory)
    }

    private static func presenter() -> UIViewController? {
        let root = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: { $0.isKeyWindow })?
            .rootViewController
        var presenter = root
        while let presented = presenter?.presentedViewController { presenter = presented }
        return presenter
    }
}
