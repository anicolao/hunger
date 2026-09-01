import Foundation
import UIKit
import WebKit

enum NativeBridgeConstants {
    static let handlerName = "hungerNativeV1"
    static let version = 1
    static let maximumRequestBytes = ExportValidator.maximumBytes + 4 * 1024
    static let maximumStandardRequestBytes = 16 * 1024
    static let maximumIdentifierBytes = 64
}

enum NativeBridgeCommand: String, CaseIterable {
    case capabilitiesGet = "capabilities.get"
    case notificationStatus = "notifications.authorizationStatus"
    case notificationRequest = "notifications.requestAuthorization"
    case notificationReplace = "notifications.replaceSchedule"
    case notificationCancel = "notifications.cancelAll"
    case notificationPending = "notifications.pendingSchedule"
    case openNotificationSettings = "app.openNotificationSettings"
    case exportShare = "export.share"
    case privacyCompleteDelete = "privacy.completeDelete"
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
    let payload: NativeBridgePayload
}

enum NativeBridgePayload: Equatable {
    case empty
    case reminderSchedule(ReminderSchedule)
    case export(ValidatedExport)
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
        guard let payload = object["payload"] as? [String: Any] else {
            throw NativeBridgeValidationError.invalidPayload
        }
        let decodedPayload: NativeBridgePayload
        switch command {
        case .notificationReplace:
            guard Set(payload.keys) == Set(["schedule"]),
                  let schedule = payload["schedule"] as? [String: Any]
            else {
                throw NativeBridgeValidationError.invalidPayload
            }
            decodedPayload = .reminderSchedule(try decodeReminderSchedule(schedule))
        case .exportShare:
            guard Set(payload.keys) == Set(["filename", "mimeType", "content"]),
                  let filename = payload["filename"] as? String,
                  let mimeType = payload["mimeType"] as? String,
                  let content = payload["content"] as? String
            else {
                throw NativeBridgeValidationError.invalidPayload
            }
            do {
                decodedPayload = .export(try ExportValidator.validate(
                    filename: filename,
                    mimeType: mimeType,
                    content: content
                ))
            } catch {
                throw NativeBridgeValidationError.invalidPayload
            }
        default:
            guard bytes.count <= NativeBridgeConstants.maximumStandardRequestBytes else {
                throw NativeBridgeValidationError.requestTooLarge
            }
            guard payload.isEmpty else {
                throw NativeBridgeValidationError.invalidPayload
            }
            decodedPayload = .empty
        }
        return NativeBridgeRequest(id: id, command: command, payload: decodedPayload)
    }

    private static func decodeReminderSchedule(
        _ value: [String: Any]
    ) throws -> ReminderSchedule {
        guard Set(value.keys) == Set(["version", "message", "items"]),
              let version = value["version"] as? Int,
              version == 1,
              let message = value["message"] as? String,
              message == NotificationSchedule.message,
              let values = value["items"] as? [[String: Any]],
              values.count <= NotificationSchedule.identifiers.count
        else {
            throw NativeBridgeValidationError.invalidPayload
        }

        var items: [ReminderScheduleItem] = []
        var seen = Set<String>()
        for item in values {
            guard let identifier = item["identifier"] as? String,
                  NotificationSchedule.identifiers.contains(identifier),
                  seen.insert(identifier).inserted,
                  let kind = item["kind"] as? String,
                  let repeatsDaily = item["repeatsDaily"] as? Bool
            else {
                throw NativeBridgeValidationError.invalidPayload
            }
            let hour = item["hour"] as? Int
            let fireAt = (item["fireAt"] as? NSNumber)?.int64Value
            if repeatsDaily {
                guard Set(item.keys) == Set(["identifier", "kind", "hour", "repeatsDaily"]),
                      let hour,
                      NotificationSchedule.windowHours.values.contains(hour),
                      ["window", "context", "experiment"].contains(kind)
                else {
                    throw NativeBridgeValidationError.invalidPayload
                }
                if kind == "window" {
                    let name = String(identifier.split(separator: ".").last ?? "")
                    guard NotificationSchedule.windowHours[name] == hour else {
                        throw NativeBridgeValidationError.invalidPayload
                    }
                } else {
                    guard identifier == "appetite.reminder.\(kind)" else {
                        throw NativeBridgeValidationError.invalidPayload
                    }
                }
            } else {
                guard Set(item.keys) == Set(["identifier", "kind", "fireAt", "repeatsDaily"]),
                      kind == "pending-completion",
                      identifier == "appetite.reminder.pending-completion",
                      let fireAt,
                      fireAt > 0
                else {
                    throw NativeBridgeValidationError.invalidPayload
                }
            }
            items.append(ReminderScheduleItem(
                identifier: identifier,
                kind: kind,
                hour: hour,
                fireAt: fireAt,
                repeatsDaily: repeatsDaily
            ))
        }
        return ReminderSchedule(version: version, message: message, items: items)
    }
}

@MainActor
final class NativeBridge: NSObject, WKScriptMessageHandlerWithReply {
    private let uiTestEvidenceEnabled: Bool
    private let notifications: NotificationCoordinating
    private let shareCoordinator: ShareCoordinating

    init(
        notifications: NotificationCoordinating = NotificationCoordinator(),
        shareCoordinator: ShareCoordinating = ShareCoordinator(),
        uiTestEvidenceEnabled: Bool = false
    ) {
        self.notifications = notifications
        self.shareCoordinator = shareCoordinator
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
            if request.command == .capabilitiesGet {
                replyHandler(success(id: request.id, value: [
                    "version": NativeBridgeConstants.version,
                    "platform": "ios",
                    "commands": NativeBridgeCommand.allCases.map(\.rawValue)
                ]), nil)
                addUITestEvidenceIfNeeded(to: message.webView)
                return
            }
            Task { @MainActor in
                do {
                    let value = try await dispatch(request)
                    replyHandler(self.success(id: request.id, value: value), nil)
                } catch let error as NativeBridgeValidationError {
                    replyHandler(self.failure(id: request.id, error: error), nil)
                } catch {
                    replyHandler(self.failure(id: request.id, code: "native_error"), nil)
                }
            }
        } catch let error as NativeBridgeValidationError {
            let id = (message.body as? [String: Any])?["id"] as? String ?? "invalid"
            replyHandler(failure(id: id, error: error), nil)
        } catch {
            replyHandler(nil, "native_error")
        }
    }

    private func dispatch(_ request: NativeBridgeRequest) async throws -> [String: Any] {
        switch request.command {
        case .capabilitiesGet:
            return [:]
        case .notificationStatus:
            return ["status": await notifications.authorizationStatus().rawValue]
        case .notificationRequest:
            return ["status": try await notifications.requestAuthorization().rawValue]
        case .notificationReplace:
            guard case let .reminderSchedule(schedule) = request.payload else {
                throw NativeBridgeValidationError.invalidPayload
            }
            return ["scheduled": try await notifications.replaceSchedule(schedule)]
        case .notificationCancel:
            await notifications.cancelAll()
            return ["cancelled": true]
        case .notificationPending:
            let identifiers = await notifications.pendingIdentifiers()
            return ["scheduled": identifiers.count, "identifiers": identifiers]
        case .openNotificationSettings:
            guard let url = URL(string: UIApplication.openNotificationSettingsURLString) else {
                return ["opened": false]
            }
            return ["opened": await UIApplication.shared.open(url)]
        case .exportShare:
            guard case let .export(export) = request.payload else {
                throw NativeBridgeValidationError.invalidPayload
            }
            try await shareCoordinator.share(export)
            return ["shared": true]
        case .privacyCompleteDelete:
            await notifications.cancelAll()
            try shareCoordinator.removeTemporaryExports()
            return ["deleted": true]
        }
    }

    private func success(id: String, value: Any) -> [String: Any] {
        ["ok": true, "id": id, "value": value]
    }

    private func failure(
        id: String,
        error: NativeBridgeValidationError
    ) -> [String: Any] {
        failure(id: id, code: error.rawValue)
    }

    private func failure(id: String, code: String) -> [String: Any] {
        [
            "ok": false,
            "id": id,
            "error": [
                "code": code,
                "message": "The native request was rejected."
            ]
        ]
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
