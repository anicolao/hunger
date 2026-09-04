package com.anicolao.hunger

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class BridgeValidatorTest {
    @Test fun acceptsVersionedCapabilitiesRequest() {
        val request = BridgeValidator.decode(request("capabilities.get"), true)
        assertEquals("request_1", request.id)
        assertEquals(BridgeCommand.CAPABILITIES, request.command)
        assertEquals(BridgePayload.Empty, request.payload)
    }

    @Test fun rejectsSubframesUnknownCommandsAndUnexpectedPayload() {
        assertCode("invalid_source") { BridgeValidator.decode(request("capabilities.get"), false) }
        assertCode("unknown_command") { BridgeValidator.decode(request("records.write"), true) }
        assertCode("invalid_payload") {
            BridgeValidator.decode(request("notifications.cancelAll", JSONObject().put("extra", true)), true)
        }
    }

    @Test fun acceptsOnlyTheDerivedReminderContract() {
        val schedule = JSONObject()
            .put("version", 1)
            .put("message", REMINDER_MESSAGE)
            .put("items", JSONArray().put(JSONObject()
                .put("identifier", "appetite.reminder.morning")
                .put("kind", "window")
                .put("hour", 9)
                .put("repeatsDaily", true)))
        val decoded = BridgeValidator.decode(
            request("notifications.replaceSchedule", JSONObject().put("schedule", schedule)),
            true,
        )
        assertEquals(9, ((decoded.payload as BridgePayload.Reminders).value.items.single().hour))

        schedule.getJSONArray("items").getJSONObject(0).put("hour", 10)
        assertCode("invalid_payload") {
            BridgeValidator.decode(request("notifications.replaceSchedule", JSONObject().put("schedule", schedule)), true)
        }
    }

    @Test fun constrainsPrivateExports() {
        val payload = JSONObject()
            .put("filename", "appetite-profile.json")
            .put("mimeType", "application/json")
            .put("content", "{}\n")
        val decoded = BridgeValidator.decode(request("export.share", payload), true)
        assertEquals("appetite-profile.json", (decoded.payload as BridgePayload.Export).value.filename)
        payload.put("filename", "../../private.json")
        assertCode("invalid_payload") { BridgeValidator.decode(request("export.share", payload), true) }
    }

    private fun request(command: String, payload: JSONObject = JSONObject()) = JSONObject()
        .put("version", 1)
        .put("id", "request_1")
        .put("command", command)
        .put("payload", payload)
        .toString()

    private fun assertCode(code: String, block: () -> Unit) {
        assertEquals(code, assertThrows(BridgeValidationException::class.java, block).code)
    }
}
