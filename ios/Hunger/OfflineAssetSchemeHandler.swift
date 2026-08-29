import CryptoKit
import Foundation
import WebKit

struct WebAssetManifest: Decodable {
    struct Entry: Decodable, Equatable {
        let path: String
        let mimeType: String
        let sha256: String
        let bytes: Int
    }

    let version: Int
    let files: [Entry]
}

enum OfflineAssetError: Error, Equatable {
    case invalidOrigin
    case invalidPath
    case missingAsset
    case invalidManifest
    case integrityFailure
}

@MainActor
final class OfflineAssetSchemeHandler: NSObject, WKURLSchemeHandler {
    private let resourceRoot: URL
    private let entries: [String: WebAssetManifest.Entry]

    init(bundle: Bundle = .main) throws {
        guard let resourceRoot = bundle.resourceURL?.appendingPathComponent("WebApp", isDirectory: true),
              let manifestURL = bundle.url(
                forResource: "asset-manifest",
                withExtension: "json",
                subdirectory: "WebApp"
              )
        else {
            throw OfflineAssetError.invalidManifest
        }
        let manifest = try JSONDecoder().decode(
            WebAssetManifest.self,
            from: Data(contentsOf: manifestURL)
        )
        guard manifest.version == 1,
              manifest.files.allSatisfy({ !$0.path.isEmpty }),
              Set(manifest.files.map(\.path)).count == manifest.files.count
        else {
            throw OfflineAssetError.invalidManifest
        }
        self.resourceRoot = resourceRoot
        entries = Dictionary(uniqueKeysWithValues: manifest.files.map { ($0.path, $0) })
    }

    nonisolated static func assetPath(for url: URL, availablePaths: Set<String>) throws -> String {
        guard url.scheme?.lowercased() == PersistenceConstants.scheme,
              url.host?.lowercased() == PersistenceConstants.host,
              url.user == nil,
              url.password == nil,
              url.port == nil
        else {
            throw OfflineAssetError.invalidOrigin
        }

        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            throw OfflineAssetError.invalidPath
        }
        let encodedPath = components.percentEncodedPath
        guard let decodedPath = encodedPath.removingPercentEncoding,
              decodedPath.removingPercentEncoding == decodedPath,
              !decodedPath.contains("\\"),
              !decodedPath.contains("\0")
        else {
            throw OfflineAssetError.invalidPath
        }

        let pathComponents = decodedPath.split(separator: "/", omittingEmptySubsequences: false)
        guard !pathComponents.contains("."),
              !pathComponents.contains(".."),
              !decodedPath.contains("//")
        else {
            throw OfflineAssetError.invalidPath
        }

        let trimmed = decodedPath.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let candidate: String
        if trimmed.isEmpty {
            candidate = "index.html"
        } else if (trimmed as NSString).pathExtension.isEmpty {
            candidate = "\(trimmed).html"
        } else {
            candidate = trimmed
        }

        guard availablePaths.contains(candidate) else {
            throw OfflineAssetError.missingAsset
        }
        return candidate
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: any WKURLSchemeTask) {
        do {
            guard urlSchemeTask.request.httpMethod == nil || urlSchemeTask.request.httpMethod == "GET",
                  let url = urlSchemeTask.request.url
            else {
                throw OfflineAssetError.invalidPath
            }
            let relativePath = try Self.assetPath(for: url, availablePaths: Set(entries.keys))
            guard let entry = entries[relativePath] else {
                throw OfflineAssetError.missingAsset
            }
            let fileURL = resourceRoot.appendingPathComponent(relativePath, isDirectory: false)
            let data = try Data(contentsOf: fileURL, options: .mappedIfSafe)
            guard data.count == entry.bytes,
                  SHA256.hash(data: data).map({ String(format: "%02x", $0) }).joined() == entry.sha256
            else {
                throw OfflineAssetError.integrityFailure
            }
            let response = URLResponse(
                url: url,
                mimeType: entry.mimeType,
                expectedContentLength: data.count,
                textEncodingName: entry.mimeType.hasPrefix("text/") ? "utf-8" : nil
            )
            urlSchemeTask.didReceive(response)
            urlSchemeTask.didReceive(data)
            urlSchemeTask.didFinish()
        } catch {
            urlSchemeTask.didFailWithError(error)
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: any WKURLSchemeTask) {}
}
