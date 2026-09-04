package com.anicolao.hunger

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime

internal const val NOTIFICATION_CHANNEL_ID = "appetite.reminders.v1"
internal const val REMINDER_ACTION = "com.anicolao.hunger.REMINDER"
internal const val EXTRA_REMINDER_KIND = "reminderKind"

internal class NotificationCoordinator(private val context: Context) {
    private val alarms = context.getSystemService(AlarmManager::class.java)
    private val preferences = context.getSharedPreferences("native-reminders-v1", Context.MODE_PRIVATE)

    fun authorizationStatus(): String {
        if (Build.VERSION.SDK_INT < 33) {
            return if (NotificationManagerCompat.from(context).areNotificationsEnabled()) "authorized" else "denied"
        }
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) {
            return if (preferences.getBoolean("permission-requested", false)) "denied" else "not_determined"
        }
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS,
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            return if (preferences.getBoolean("permission-requested", false)) "denied" else "not_determined"
        }
        return "authorized"
    }

    fun markPermissionRequested() {
        preferences.edit().putBoolean("permission-requested", true).apply()
    }

    fun replaceSchedule(schedule: ReminderSchedule): Int {
        cancelScheduledAlarms()
        store(schedule)
        createChannel()
        schedule.items.forEach(::schedule)
        return schedule.items.size
    }

    fun restoreSchedule() {
        val schedule = load() ?: return
        cancelScheduledAlarms()
        schedule.items.forEach(::schedule)
    }

    fun afterDelivery(identifier: String) {
        val schedule = load() ?: return
        val item = schedule.items.firstOrNull { it.identifier == identifier } ?: return
        if (item.repeatsDaily) {
            schedule(item)
        } else {
            store(schedule.copy(items = schedule.items.filterNot { it.identifier == identifier }))
        }
    }

    fun cancelAll() {
        cancelScheduledAlarms()
        preferences.edit().remove("schedule").apply()
        NotificationManagerCompat.from(context).cancelAll()
    }

    fun pendingIdentifiers(): List<String> = load()?.items?.map { it.identifier }?.sorted().orEmpty()

    fun post(identifier: String, kind: String) {
        createChannel()
        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(EXTRA_REMINDER_KIND, kind)
        }
        val openPendingIntent = PendingIntent.getActivity(
            context,
            identifier.hashCode(),
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(context, NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(context.getString(R.string.app_name))
            .setContentText(REMINDER_MESSAGE)
            .setContentIntent(openPendingIntent)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()
        if (authorizationStatus() == "authorized") {
            try {
                NotificationManagerCompat.from(context).notify(identifier.hashCode(), notification)
            } catch (_: SecurityException) {
                // Permission can be revoked between the explicit status check and delivery.
            }
        }
    }

    private fun schedule(item: ReminderItem) {
        val triggerAt = if (item.repeatsDaily) nextOccurrence(item.hour!!) else item.fireAt!!
        if (triggerAt <= System.currentTimeMillis()) return
        alarms.setAndAllowWhileIdle(
            AlarmManager.RTC_WAKEUP,
            triggerAt,
            alarmIntent(item),
        )
    }

    private fun cancelScheduledAlarms() {
        ALL_REMINDER_IDENTIFIERS.forEach { identifier ->
            alarms.cancel(alarmIntent(ReminderItem(identifier, "window", true, hour = 9)))
        }
    }

    private fun alarmIntent(item: ReminderItem): PendingIntent {
        val intent = Intent(context, ReminderReceiver::class.java).apply {
            action = REMINDER_ACTION
            putExtra("identifier", item.identifier)
            putExtra(EXTRA_REMINDER_KIND, item.kind)
        }
        return PendingIntent.getBroadcast(
            context,
            item.identifier.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun createChannel() {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(
            NOTIFICATION_CHANNEL_ID,
            context.getString(R.string.notification_channel_name),
            NotificationManager.IMPORTANCE_DEFAULT,
        ).apply {
            description = context.getString(R.string.notification_channel_description)
            setShowBadge(false)
        })
    }

    private fun store(schedule: ReminderSchedule) {
        val items = JSONArray()
        schedule.items.forEach { item ->
            items.put(JSONObject()
                .put("identifier", item.identifier)
                .put("kind", item.kind)
                .put("repeatsDaily", item.repeatsDaily)
                .apply {
                    item.hour?.let { put("hour", it) }
                    item.fireAt?.let { put("fireAt", it) }
                })
        }
        preferences.edit().putString("schedule", JSONObject()
            .put("message", schedule.message)
            .put("items", items).toString()).apply()
    }

    private fun load(): ReminderSchedule? {
        return try {
            val objectValue = JSONObject(preferences.getString("schedule", null) ?: return null)
            if (objectValue.optString("message") != REMINDER_MESSAGE) return null
            val items = objectValue.getJSONArray("items")
            ReminderSchedule(REMINDER_MESSAGE, buildList {
                repeat(items.length()) { index ->
                    val item = items.getJSONObject(index)
                    add(ReminderItem(
                        item.getString("identifier"),
                        item.getString("kind"),
                        item.getBoolean("repeatsDaily"),
                        item.optInt("hour").takeIf { item.has("hour") },
                        item.optLong("fireAt").takeIf { item.has("fireAt") },
                    ))
                }
            })
        } catch (_: Exception) {
            preferences.edit().remove("schedule").apply()
            null
        }
    }

    companion object {
        val ALL_REMINDER_IDENTIFIERS = setOf(
            "appetite.reminder.morning",
            "appetite.reminder.midday",
            "appetite.reminder.evening",
            "appetite.reminder.pending-completion",
            "appetite.reminder.context",
            "appetite.reminder.experiment",
        )

        internal fun nextOccurrence(hour: Int, now: Long = System.currentTimeMillis(), zone: ZoneId = ZoneId.systemDefault()): Long {
            val current = ZonedDateTime.ofInstant(Instant.ofEpochMilli(now), zone)
            var target = current.toLocalDate().atTime(hour, 0).atZone(zone)
            if (!target.toInstant().isAfter(current.toInstant())) target = target.plusDays(1)
            return target.toInstant().toEpochMilli()
        }
    }
}
