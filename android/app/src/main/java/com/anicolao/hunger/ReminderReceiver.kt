package com.anicolao.hunger

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != REMINDER_ACTION) return
        val identifier = intent.getStringExtra("identifier") ?: return
        val kind = intent.getStringExtra(EXTRA_REMINDER_KIND) ?: return
        if (identifier !in NotificationCoordinator.ALL_REMINDER_IDENTIFIERS ||
            kind !in setOf("window", "context", "experiment", "pending-completion")) return
        NotificationCoordinator(context).apply {
            post(identifier, kind)
            afterDelivery(identifier)
        }
    }
}

class ReminderRestoreReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action in setOf(
                Intent.ACTION_BOOT_COMPLETED,
                Intent.ACTION_TIME_CHANGED,
                Intent.ACTION_TIMEZONE_CHANGED,
                Intent.ACTION_MY_PACKAGE_REPLACED,
            )) {
            NotificationCoordinator(context).restoreSchedule()
        }
    }
}
