package com.anicolao.hunger

import android.content.Context
import android.net.Uri
import android.util.Log
import android.webkit.WebResourceResponse
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject
import java.security.MessageDigest

internal data class WebAssetEntry(
    val path: String,
    val mimeType: String,
    val sha256: String,
    val bytes: Int,
)

internal class OfflineAssetStore(private val context: Context) : WebViewAssetLoader.PathHandler {
    private val entries: Map<String, WebAssetEntry> = loadManifest()

    fun resolvedUrl(url: Uri): Uri? {
        if (url.scheme?.lowercase() != "https" || url.host?.lowercase() != "appassets.androidplatform.net" ||
            url.userInfo != null || url.port != -1) return null
        val relativePath = resolvePath(url.encodedPath.orEmpty(), entries.keys) ?: return null
        return url.buildUpon().encodedPath("/assets/webapp/$relativePath").build()
    }

    override fun handle(path: String): WebResourceResponse? {
        val entry = entries[path] ?: return null
        return try {
            val data = context.assets.open("webapp/$path").use { it.readBytes() }
            val digest = MessageDigest.getInstance("SHA-256")
                .digest(data)
                .joinToString("") { byte -> "%02x".format(byte) }
            if (data.size != entry.bytes || digest != entry.sha256) {
                Log.e(LOG_TAG, "Integrity check failed for $path")
                return null
            }
            WebResourceResponse(
                entry.mimeType,
                if (entry.mimeType.startsWith("text/") || entry.mimeType in setOf("text/javascript", "application/json", "image/svg+xml")) "utf-8" else null,
                200,
                "OK",
                mapOf(
                    "Cache-Control" to "no-cache",
                    "X-Content-Type-Options" to "nosniff",
                ),
                data.inputStream(),
            )
        } catch (error: Exception) {
            Log.e(LOG_TAG, "Could not serve packaged asset $path", error)
            null
        }
    }

    private fun loadManifest(): Map<String, WebAssetEntry> {
        val manifest = context.assets.open("webapp/asset-manifest.json").bufferedReader().use { reader ->
            JSONObject(reader.readText())
        }
        check(manifest.optInt("version", -1) == 1) { "Unsupported offline asset manifest" }
        val files = manifest.getJSONArray("files")
        val values = buildMap {
            repeat(files.length()) { index ->
                val item = files.getJSONObject(index)
                val entry = WebAssetEntry(
                    path = item.getString("path"),
                    mimeType = item.getString("mimeType"),
                    sha256 = item.getString("sha256"),
                    bytes = item.getInt("bytes"),
                )
                check(isSafeManifestPath(entry.path) && entry.bytes >= 0 && SHA256.matches(entry.sha256)) {
                    "Invalid offline asset entry"
                }
                check(put(entry.path, entry) == null) { "Duplicate offline asset entry" }
            }
        }
        check(values.containsKey("index.html")) { "Offline entry point is missing" }
        return values
    }

    companion object {
        private const val PATH_PREFIX = "/assets/webapp/"
        private const val LOG_TAG = "HungerAssets"
        private val SHA256 = Regex("^[0-9a-f]{64}$")

        internal fun resolvePath(encodedPath: String, availablePaths: Set<String>): String? {
            if (!encodedPath.startsWith(PATH_PREFIX)) return null
            val decoded = Uri.decode(encodedPath)
            if (Uri.decode(decoded) != decoded || decoded.contains('\\') || decoded.contains('\u0000') ||
                decoded.contains("//")) return null
            val relative = decoded.removePrefix(PATH_PREFIX).trimEnd('/')
            if (relative.split('/').any { it == "." || it == ".." }) return null
            val candidate = when {
                relative.isEmpty() -> "index.html"
                relative.substringAfterLast('/').contains('.') -> relative
                else -> "$relative.html"
            }
            return candidate.takeIf(availablePaths::contains)
        }

        private fun isSafeManifestPath(path: String): Boolean =
            path.isNotEmpty() && !path.startsWith('/') && !path.contains("//") && !path.contains('\\') &&
                !path.contains('\u0000') && path.split('/').none { it == "." || it == ".." }
    }
}
