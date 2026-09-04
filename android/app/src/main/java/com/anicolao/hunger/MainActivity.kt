package com.anicolao.hunger

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.util.Log
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.RenderProcessGoneDetail
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewClientCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private lateinit var notifications: NotificationCoordinator
    private var webAppReady = false
    private var pendingLifecycle: JSONObject? = null
    private var pendingPermissionReply: ((String) -> Unit)? = null
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var rendererRecoveries = 0
    private var cleanupExportsOnResume = false

    private val notificationPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) {
        pendingPermissionReply?.invoke(notifications.authorizationStatus())
        pendingPermissionReply = null
    }
    private val photoPicker = registerForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        filePathCallback?.onReceiveValue(uri?.let { arrayOf(it) })
        filePathCallback = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        notifications = NotificationCoordinator(this)
        clearTemporaryExports()
        applyAppearance(getSharedPreferences("native-appearance-v1", MODE_PRIVATE).getString("appearance", "light") ?: "light")
        configureBack()
        try {
            createWebView(savedInstanceState)
        } catch (error: Exception) {
            Log.e("HungerWebView", "Packaged application could not be opened", error)
            showFailure()
        }
        receiveNotificationIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        receiveNotificationIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        if (cleanupExportsOnResume) {
            clearTemporaryExports()
            cleanupExportsOnResume = false
        }
        if (::webView.isInitialized) sendLifecycle(JSONObject()
            .put("reason", "foreground")
            .put("occurredAt", System.currentTimeMillis()))
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.stopLoading()
            (webView.parent as? ViewGroup)?.removeView(webView)
            webView.destroy()
        }
        super.onDestroy()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        if (::webView.isInitialized) webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun createWebView(savedInstanceState: Bundle?) {
        val offlineAssets = OfflineAssetStore(this)
        val assetLoader = WebViewAssetLoader.Builder()
            .setDomain("appassets.androidplatform.net")
            .addPathHandler("/assets/webapp/", offlineAssets)
            .build()
        webView = WebView(this).apply {
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                allowFileAccess = false
                allowContentAccess = true
                javaScriptCanOpenWindowsAutomatically = false
                setSupportMultipleWindows(false)
                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                cacheMode = WebSettings.LOAD_NO_CACHE
                builtInZoomControls = false
                displayZoomControls = false
            }
            webViewClient = object : WebViewClientCompat() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                    val resolved = offlineAssets.resolvedUrl(request.url) ?: return blockedResponse()
                    return assetLoader.shouldInterceptRequest(resolved) ?: blockedResponse()
                }

                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                    offlineAssets.resolvedUrl(request.url) == null

                override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                    (view.parent as? ViewGroup)?.removeView(view)
                    view.destroy()
                    if (rendererRecoveries++ < 2) createWebView(null) else showFailure()
                    return true
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(message: ConsoleMessage): Boolean {
                    Log.d("HungerWebView", "${message.messageLevel()}: ${message.message()} (${message.sourceId()}:${message.lineNumber()})")
                    return true
                }

                override fun onShowFileChooser(
                    webView: WebView,
                    callback: ValueCallback<Array<Uri>>,
                    params: FileChooserParams,
                ): Boolean {
                    filePathCallback?.onReceiveValue(null)
                    filePathCallback = callback
                    photoPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                    return true
                }
            }
        }
        installBridge()
        setContentView(webView)
        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) webView.loadUrl(APP_ENTRY)
    }

    private fun installBridge() {
        check(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER))
        check(WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT))
        val bridge = NativeBridge(
            notifications = notifications,
            requestNotificationPermission = ::requestNotificationPermission,
            applyAppearance = ::applyAppearance,
            share = ::share,
            openNotificationSettings = ::openNotificationSettings,
            completeDelete = {
                notifications.cancelAll()
                clearTemporaryExports()
            },
            appReady = {
                webAppReady = true
                pendingLifecycle?.let(::sendLifecycle)
                pendingLifecycle = null
            },
        )
        WebViewCompat.addWebMessageListener(webView, BRIDGE_NAME, setOf(APP_ORIGIN)) {
                _, message, sourceOrigin, isMainFrame, replyProxy ->
            if (sourceOrigin.toString().removeSuffix("/") != APP_ORIGIN) {
                replyProxy.postMessage(failureReply("invalid", "invalid_source"))
            } else {
                bridge.receive(message.data ?: "", isMainFrame, replyProxy)
            }
        }
        WebViewCompat.addDocumentStartJavaScript(webView, NATIVE_BOOTSTRAP, setOf(APP_ORIGIN))
    }

    private fun configureBack() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (::webView.isInitialized && webView.canGoBack()) webView.goBack() else moveTaskToBack(true)
            }
        })
    }

    private fun requestNotificationPermission(reply: (String) -> Unit) {
        notifications.markPermissionRequested()
        if (Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS,
            ) == PackageManager.PERMISSION_GRANTED
        ) {
            reply(notifications.authorizationStatus())
            return
        }
        pendingPermissionReply = reply
        notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    @Suppress("DEPRECATION")
    private fun applyAppearance(appearance: String) {
        val dark = appearance == "dark"
        getSharedPreferences("native-appearance-v1", MODE_PRIVATE).edit().putString("appearance", appearance).apply()
        val color = Color.parseColor(if (dark) "#111C1A" else "#F7F4EE")
        window.statusBarColor = color
        window.navigationBarColor = color
        window.decorView.systemUiVisibility = if (dark) 0 else (
            android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or android.view.View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        )
    }

    private fun openNotificationSettings(): Boolean = try {
        startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, packageName))
        true
    } catch (_: Exception) { false }

    private fun share(payload: ExportPayload, completion: (Boolean) -> Unit) {
        try {
            clearTemporaryExports()
            val directory = File(cacheDir, "exports").apply { mkdirs() }
            val file = File(directory, payload.filename)
            FileOutputStream(file).use { it.write(payload.content.toByteArray(Charsets.UTF_8)) }
            val uri = FileProvider.getUriForFile(this, "$packageName.exports", file)
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = payload.mimeType
                putExtra(Intent.EXTRA_STREAM, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            cleanupExportsOnResume = true
            startActivity(Intent.createChooser(intent, "Share private appetite profile"))
            completion(true)
        } catch (_: Exception) { completion(false) }
    }

    private fun clearTemporaryExports() {
        File(cacheDir, "exports").takeIf { it.exists() }?.deleteRecursively()
    }

    private fun receiveNotificationIntent(intent: Intent?) {
        val kind = intent?.getStringExtra(EXTRA_REMINDER_KIND) ?: return
        if (kind !in setOf("window", "context", "experiment", "pending-completion")) return
        sendLifecycle(JSONObject()
            .put("reason", "notification")
            .put("occurredAt", System.currentTimeMillis())
            .put("route", "today")
            .put("kind", kind))
        intent.removeExtra(EXTRA_REMINDER_KIND)
    }

    private fun sendLifecycle(event: JSONObject) {
        if (!webAppReady) {
            if (pendingLifecycle == null || event.optString("reason") == "notification") pendingLifecycle = event
            return
        }
        webView.post { webView.evaluateJavascript(
            "globalThis.__hungerNativeLifecycle?.(${JSONObject.quote(event.toString()).let { "JSON.parse($it)" }});",
            null,
        ) }
    }

    private fun blockedResponse() = WebResourceResponse("text/plain", "utf-8", 403, "Blocked", emptyMap(), "Blocked".byteInputStream())

    private fun showFailure() {
        webView = WebView(this).apply { loadData("<h1>Learn Your Appetite could not reopen safely.</h1><p>Close and reopen the app. Your local records have not been changed.</p>", "text/html", "utf-8") }
        setContentView(webView)
    }
}
