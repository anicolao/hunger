package com.anicolao.hunger

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class OfflineAssetStoreTest {
    private val paths = setOf(
        "index.html",
        "settings.html",
        "check-in/new.html",
        "app/immutable/entry/start.js",
    )

    @Test fun mapsPrerenderedRoutesAndPackagedAssets() {
        assertEquals("index.html", OfflineAssetStore.resolvePath("/assets/webapp/", paths))
        assertEquals("settings.html", OfflineAssetStore.resolvePath("/assets/webapp/settings", paths))
        assertEquals("check-in/new.html", OfflineAssetStore.resolvePath("/assets/webapp/check-in/new/", paths))
        assertEquals(
            "app/immutable/entry/start.js",
            OfflineAssetStore.resolvePath("/assets/webapp/app/immutable/entry/start.js", paths),
        )
    }

    @Test fun rejectsUnknownPathsTraversalAndAmbiguousEncoding() {
        listOf(
            "/other/index.html",
            "/assets/webapp/missing",
            "/assets/webapp/../settings",
            "/assets/webapp/%2e%2e/settings",
            "/assets/webapp/%252e%252e/settings",
            "/assets/webapp/check-in//new",
            "/assets/webapp/check-in%5cnew",
        ).forEach { path -> assertNull(path, OfflineAssetStore.resolvePath(path, paths)) }
    }
}
