package com.anicolao.hunger

import androidx.webkit.JavaScriptReplyProxy
import org.json.JSONArray
import org.json.JSONObject

internal class NativeBridge(
    private val notifications: NotificationCoordinator,
    private val requestNotificationPermission: ((String) -> Unit) -> Unit,
    private val applyAppearance: (String) -> Unit,
    private val share: (ExportPayload, (Boolean) -> Unit) -> Unit,
    private val openNotificationSettings: () -> Boolean,
    private val completeDelete: () -> Unit,
    private val appReady: () -> Unit,
) {
    fun receive(raw: String, isMainFrame: Boolean, reply: JavaScriptReplyProxy) {
        val request = try {
            BridgeValidator.decode(raw, isMainFrame)
        } catch (error: BridgeValidationException) {
            reply.postMessage(failureReply(requestId(raw), error.code))
            return
        } catch (_: Exception) {
            reply.postMessage(failureReply(requestId(raw), "invalid_request"))
            return
        }

        try { when (request.command) {
            BridgeCommand.CAPABILITIES -> reply.success(request.id, JSONObject()
                .put("version", BRIDGE_VERSION)
                .put("platform", "android")
                .put("commands", JSONArray(BridgeCommand.entries.map { it.wireName })))
            BridgeCommand.APP_READY -> {
                appReady()
                reply.success(request.id, JSONObject().put("ready", true))
            }
            BridgeCommand.APPEARANCE -> {
                val appearance = (request.payload as BridgePayload.Appearance).value
                applyAppearance(appearance)
                reply.success(request.id, JSONObject().put("appearance", appearance))
            }
            BridgeCommand.NOTIFICATION_STATUS -> reply.success(
                request.id,
                JSONObject().put("status", notifications.authorizationStatus()),
            )
            BridgeCommand.NOTIFICATION_REQUEST -> requestNotificationPermission { status ->
                reply.success(request.id, JSONObject().put("status", status))
            }
            BridgeCommand.NOTIFICATION_REPLACE -> {
                val count = notifications.replaceSchedule((request.payload as BridgePayload.Reminders).value)
                reply.success(request.id, JSONObject().put("scheduled", count))
            }
            BridgeCommand.NOTIFICATION_CANCEL -> {
                notifications.cancelAll()
                reply.success(request.id, JSONObject().put("cancelled", true))
            }
            BridgeCommand.NOTIFICATION_PENDING -> {
                val identifiers = notifications.pendingIdentifiers()
                reply.success(request.id, JSONObject()
                    .put("scheduled", identifiers.size)
                    .put("identifiers", JSONArray(identifiers)))
            }
            BridgeCommand.NOTIFICATION_SETTINGS -> reply.success(
                request.id,
                JSONObject().put("opened", openNotificationSettings()),
            )
            BridgeCommand.EXPORT_SHARE -> share((request.payload as BridgePayload.Export).value) { shared ->
                if (shared) reply.success(request.id, JSONObject().put("shared", true))
                else reply.postMessage(failureReply(request.id, "native_error"))
            }
            BridgeCommand.PRIVACY_DELETE -> {
                completeDelete()
                reply.success(request.id, JSONObject().put("deleted", true))
            }
        } } catch (error: BridgeValidationException) {
            reply.postMessage(failureReply(request.id, error.code))
        } catch (_: Exception) {
            reply.postMessage(failureReply(request.id, "native_error"))
        }
    }

    private fun JavaScriptReplyProxy.success(id: String, value: JSONObject) = postMessage(successReply(id, value))

    private fun requestId(raw: String): String = try {
        JSONObject(raw).optString("id").takeIf { it.matches(Regex("^[A-Za-z0-9_-]{1,64}$")) } ?: "invalid"
    } catch (_: Exception) { "invalid" }
}
