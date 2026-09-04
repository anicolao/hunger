package com.anicolao.hunger

import org.json.JSONArray
import org.json.JSONObject

internal const val BRIDGE_VERSION = 1
internal const val BRIDGE_NAME = "hungerNativeV1"
internal const val APP_ORIGIN = "https://appassets.androidplatform.net"
internal const val APP_ROOT = "$APP_ORIGIN/assets/webapp/"
internal const val APP_ENTRY = "${APP_ROOT}index.html"
internal const val REMINDER_MESSAGE = "Want to notice how your body feels?"

internal enum class BridgeCommand(val wireName: String) {
    CAPABILITIES("capabilities.get"),
    APP_READY("app.ready"),
    APPEARANCE("appearance.set"),
    NOTIFICATION_STATUS("notifications.authorizationStatus"),
    NOTIFICATION_REQUEST("notifications.requestAuthorization"),
    NOTIFICATION_REPLACE("notifications.replaceSchedule"),
    NOTIFICATION_CANCEL("notifications.cancelAll"),
    NOTIFICATION_PENDING("notifications.pendingSchedule"),
    NOTIFICATION_SETTINGS("app.openNotificationSettings"),
    EXPORT_SHARE("export.share"),
    PRIVACY_DELETE("privacy.completeDelete");

    companion object {
        fun fromWireName(value: String): BridgeCommand? = entries.firstOrNull { it.wireName == value }
    }
}

internal data class ReminderItem(
    val identifier: String,
    val kind: String,
    val repeatsDaily: Boolean,
    val hour: Int? = null,
    val fireAt: Long? = null,
)

internal data class ReminderSchedule(val message: String, val items: List<ReminderItem>)

internal data class ExportPayload(val filename: String, val mimeType: String, val content: String)

internal sealed interface BridgePayload {
    data object Empty : BridgePayload
    data class Appearance(val value: String) : BridgePayload
    data class Reminders(val value: ReminderSchedule) : BridgePayload
    data class Export(val value: ExportPayload) : BridgePayload
}

internal data class BridgeRequest(
    val id: String,
    val command: BridgeCommand,
    val payload: BridgePayload,
)

internal class BridgeValidationException(val code: String) : Exception(code)

internal object BridgeValidator {
    private const val MAX_REQUEST_BYTES = 800_000
    private const val MAX_STANDARD_REQUEST_BYTES = 16_384
    private const val MAX_EXPORT_BYTES = 750_000
    private val idPattern = Regex("^[A-Za-z0-9_-]{1,64}$")
    private val identifiers = setOf(
        "appetite.reminder.morning",
        "appetite.reminder.midday",
        "appetite.reminder.evening",
        "appetite.reminder.pending-completion",
        "appetite.reminder.context",
        "appetite.reminder.experiment",
    )
    private val windowHours = mapOf("morning" to 9, "midday" to 13, "evening" to 18)

    fun decode(raw: String, isMainFrame: Boolean): BridgeRequest {
        if (!isMainFrame) fail("invalid_source")
        if (raw.toByteArray(Charsets.UTF_8).size > MAX_REQUEST_BYTES) fail("request_too_large")
        val objectValue = try { JSONObject(raw) } catch (_: Exception) { fail("invalid_request") }
        requireKeys(objectValue, "version", "id", "command", "payload")
        if (objectValue.optInt("version", -1) != BRIDGE_VERSION) fail("wrong_version")
        val id = objectValue.optString("id")
        if (!idPattern.matches(id)) fail("invalid_request")
        val command = BridgeCommand.fromWireName(objectValue.optString("command")) ?: fail("unknown_command")
        val payload = objectValue.optJSONObject("payload") ?: fail("invalid_payload")
        val decoded = when (command) {
            BridgeCommand.APPEARANCE -> decodeAppearance(payload)
            BridgeCommand.NOTIFICATION_REPLACE -> decodeSchedule(payload)
            BridgeCommand.EXPORT_SHARE -> decodeExport(payload)
            else -> {
                if (raw.toByteArray(Charsets.UTF_8).size > MAX_STANDARD_REQUEST_BYTES) fail("request_too_large")
                requireKeys(payload)
                BridgePayload.Empty
            }
        }
        return BridgeRequest(id, command, decoded)
    }

    private fun decodeAppearance(payload: JSONObject): BridgePayload {
        requireKeys(payload, "appearance")
        val appearance = payload.optString("appearance")
        if (appearance !in setOf("light", "dark")) fail("invalid_payload")
        return BridgePayload.Appearance(appearance)
    }

    private fun decodeSchedule(payload: JSONObject): BridgePayload {
        requireKeys(payload, "schedule")
        val schedule = payload.optJSONObject("schedule") ?: fail("invalid_payload")
        requireKeys(schedule, "version", "message", "items")
        if (schedule.optInt("version", -1) != 1 || schedule.optString("message") != REMINDER_MESSAGE) {
            fail("invalid_payload")
        }
        val values = schedule.optJSONArray("items") ?: fail("invalid_payload")
        if (values.length() > identifiers.size) fail("invalid_payload")
        val seen = mutableSetOf<String>()
        val items = buildList {
            repeat(values.length()) { index ->
                val item = values.optJSONObject(index) ?: fail("invalid_payload")
                val identifier = item.optString("identifier")
                val kind = item.optString("kind")
                val repeats = item.opt("repeatsDaily") as? Boolean ?: fail("invalid_payload")
                if (identifier !in identifiers || !seen.add(identifier)) fail("invalid_payload")
                if (repeats) {
                    requireKeys(item, "identifier", "kind", "hour", "repeatsDaily")
                    val hour = item.optInt("hour", -1)
                    val valid = if (kind == "window") {
                        windowHours[identifier.substringAfterLast('.')] == hour
                    } else {
                        kind in setOf("context", "experiment") && identifier == "appetite.reminder.$kind" && hour in windowHours.values
                    }
                    if (!valid) fail("invalid_payload")
                    add(ReminderItem(identifier, kind, true, hour = hour))
                } else {
                    requireKeys(item, "identifier", "kind", "fireAt", "repeatsDaily")
                    val fireAt = item.optLong("fireAt", -1)
                    if (identifier != "appetite.reminder.pending-completion" || kind != "pending-completion" || fireAt <= 0) {
                        fail("invalid_payload")
                    }
                    add(ReminderItem(identifier, kind, false, fireAt = fireAt))
                }
            }
        }
        return BridgePayload.Reminders(ReminderSchedule(REMINDER_MESSAGE, items))
    }

    private fun decodeExport(payload: JSONObject): BridgePayload {
        requireKeys(payload, "filename", "mimeType", "content")
        val filename = payload.optString("filename")
        val mimeType = payload.optString("mimeType")
        val content = payload.optString("content")
        val expectedMime = when (filename) {
            "appetite-profile.json" -> "application/json"
            "appetite-profile.html" -> "text/html"
            else -> fail("invalid_payload")
        }
        if (mimeType != expectedMime || content.toByteArray(Charsets.UTF_8).size > MAX_EXPORT_BYTES) fail("invalid_payload")
        return BridgePayload.Export(ExportPayload(filename, mimeType, content))
    }

    private fun requireKeys(value: JSONObject, vararg expected: String) {
        val actual = value.keys().asSequence().toSet()
        if (actual != expected.toSet()) fail("invalid_payload")
    }

    private fun fail(code: String): Nothing = throw BridgeValidationException(code)
}

internal fun successReply(id: String, value: JSONObject): String = JSONObject()
    .put("ok", true).put("id", id).put("value", value).toString()

internal fun failureReply(id: String, code: String): String = JSONObject()
    .put("ok", false).put("id", id)
    .put("error", JSONObject().put("code", code).put("message", "The native request was rejected."))
    .toString()

internal fun JSONArray.toStringList(): List<String> = buildList {
    repeat(length()) { add(optString(it)) }
}
