package com.anicolao.hunger

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.ZoneId
import java.time.ZonedDateTime

class NotificationCoordinatorTest {
    @Test fun nextDailyOccurrenceUsesTheLocalCalendarAndNeverThePast() {
        val zone = ZoneId.of("America/Toronto")
        val before = ZonedDateTime.of(2026, 9, 4, 8, 30, 0, 0, zone).toInstant().toEpochMilli()
        val after = ZonedDateTime.of(2026, 9, 4, 9, 30, 0, 0, zone).toInstant().toEpochMilli()
        assertEquals(
            ZonedDateTime.of(2026, 9, 4, 9, 0, 0, 0, zone).toInstant().toEpochMilli(),
            NotificationCoordinator.nextOccurrence(9, before, zone),
        )
        assertEquals(
            ZonedDateTime.of(2026, 9, 5, 9, 0, 0, 0, zone).toInstant().toEpochMilli(),
            NotificationCoordinator.nextOccurrence(9, after, zone),
        )
        assertTrue(NotificationCoordinator.nextOccurrence(9, after, zone) > after)
    }
}
