import Foundation
import WebKit

enum NativeBridgeConstants {
    static let handlerName = "hungerNativeV1"
    static let version = 1
    static let maximumRequestBytes = 16 * 1024
    static let maximumIdentifierBytes = 64
}

enum NativeBridgeCommand: String, CaseIterable {
    case capabilitiesGet = "capabilities.get"
}

struct NativeBridgeSource: Equatable {
    let isMainFrame: Bool
    let scheme: String
    let host: String
    let port: Int

    var isTrusted: Bool {
        isMainFrame
            && scheme.lowercased() == PersistenceConstants.scheme
            && host.lowercased() == PersistenceConstants.host
            && port == 0
    }
}

struct NativeBridgeRequest: Equatable {
    let id: String
    let command: NativeBridgeCommand
}

enum NativeBridgeValidationError: String, Error, Equatable {
    case invalidSource = "invalid_source"
    case invalidRequest = "invalid_request"
    case requestTooLarge = "request_too_large"
    case wrongVersion = "wrong_version"
    case unknownCommand = "unknown_command"
    case invalidPayload = "invalid_payload"
}

enum NativeBridgeValidator {
    static func decode(body: Any, source: NativeBridgeSource) throws -> NativeBridgeRequest {
        guard source.isTrusted else {
            throw NativeBridgeValidationError.invalidSource
        }
        guard JSONSerialization.isValidJSONObject(body),
              let bytes = try? JSONSerialization.data(withJSONObject: body),
              bytes.count <= NativeBridgeConstants.maximumRequestBytes,
              let object = body as? [String: Any],
              Set(object.keys) == Set(["version", "id", "command", "payload"])
        else {
            if let bytes = try? JSONSerialization.data(withJSONObject: body),
               bytes.count > NativeBridgeConstants.maximumRequestBytes {
                throw NativeBridgeValidationError.requestTooLarge
            }
            throw NativeBridgeValidationError.invalidRequest
        }
        guard let version = object["version"] as? Int,
              version == NativeBridgeConstants.version
        else {
            throw NativeBridgeValidationError.wrongVersion
        }
        guard let id = object["id"] as? String,
              !id.isEmpty,
              id.lengthOfBytes(using: .utf8) <= NativeBridgeConstants.maximumIdentifierBytes,
              id.unicodeScalars.allSatisfy({
                  CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_")).contains($0)
              })
        else {
            throw NativeBridgeValidationError.invalidRequest
        }
        guard let commandValue = object["command"] as? String,
              let command = NativeBridgeCommand(rawValue: commandValue)
        else {
            throw NativeBridgeValidationError.unknownCommand
        }
        guard let payload = object["payload"] as? [String: Any], payload.isEmpty else {
            throw NativeBridgeValidationError.invalidPayload
        }
        return NativeBridgeRequest(id: id, command: command)
    }
}

@MainActor
final class NativeBridge: NSObject, WKScriptMessageHandlerWithReply {
    private let uiTestEvidenceEnabled: Bool

    init(uiTestEvidenceEnabled: Bool = false) {
        self.uiTestEvidenceEnabled = uiTestEvidenceEnabled
    }

    static var bootstrapScript: WKUserScript {
        let source = #"""
        (() => {
          if (globalThis.hungerNative) return;
          const rawHandler = globalThis.webkit?.messageHandlers?.hungerNativeV1;
          if (!rawHandler) return;
          const request = async (command, payload = {}) => {
            const id = globalThis.crypto?.randomUUID?.() ?? `request-${Date.now()}`;
            const reply = await rawHandler.postMessage({ version: 1, id, command, payload });
            if (!reply || reply.id !== id || typeof reply.ok !== 'boolean') {
              throw new Error('The native bridge returned an invalid reply.');
            }
            if (!reply.ok) {
              const error = new Error(reply.error?.message ?? 'The native request failed.');
              error.code = reply.error?.code ?? 'native_error';
              throw error;
            }
            return reply.value;
          };
          Object.defineProperty(globalThis, 'hungerNative', {
            configurable: false,
            enumerable: false,
            writable: false,
            value: Object.freeze({ request })
          });
        })();
        """#
        return WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true)
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage,
        replyHandler: @escaping @MainActor @Sendable (Any?, String?) -> Void
    ) {
        let origin = message.frameInfo.securityOrigin
        let source = NativeBridgeSource(
            isMainFrame: message.frameInfo.isMainFrame,
            scheme: origin.protocol,
            host: origin.host,
            port: origin.port
        )
        do {
            let request = try NativeBridgeValidator.decode(body: message.body, source: source)
            switch request.command {
            case .capabilitiesGet:
                replyHandler([
                    "ok": true,
                    "id": request.id,
                    "value": [
                        "version": NativeBridgeConstants.version,
                        "platform": "ios",
                        "commands": NativeBridgeCommand.allCases.map(\.rawValue)
                    ]
                ], nil)
                addUITestEvidenceIfNeeded(to: message.webView)
            }
        } catch let error as NativeBridgeValidationError {
            let id = (message.body as? [String: Any])?["id"] as? String ?? "invalid"
            replyHandler([
                "ok": false,
                "id": id,
                "error": [
                    "code": error.rawValue,
                    "message": "The native request was rejected."
                ]
            ], nil)
        } catch {
            replyHandler(nil, "native_error")
        }
    }

    func sendLifecycle(_ event: [String: Any], to webView: WKWebView) async {
        guard JSONSerialization.isValidJSONObject(event) else { return }
        _ = try? await webView.callAsyncJavaScript(
            "globalThis.__hungerNativeLifecycle?.(event)",
            arguments: ["event": event],
            in: nil,
            contentWorld: .page
        )
    }

    private func addUITestEvidenceIfNeeded(to webView: WKWebView?) {
#if DEBUG
        guard uiTestEvidenceEnabled, let webView else { return }
        Task {
            _ = try? await webView.callAsyncJavaScript(
                #"""
                if (!document.querySelector('[data-native-bridge-evidence]')) {
                  const marker = document.createElement('div');
                  marker.dataset.nativeBridgeEvidence = 'ready';
                  marker.setAttribute('role', 'status');
                  marker.setAttribute('aria-label', 'Native bridge ready');
                  marker.style.position = 'fixed';
                  marker.style.width = '1px';
                  marker.style.height = '1px';
                  marker.style.overflow = 'hidden';
                  document.body.append(marker);
                }
                """#,
                arguments: [:],
                in: nil,
                contentWorld: .page
            )
        }
#endif
    }
}
