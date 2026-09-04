package com.anicolao.hunger

import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class OfflineShellTest {
    @Test fun coldLaunchUsesPackagedOriginAndDirectOnboarding() {
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        waitFor(scenario, "document.body.innerText.includes('Choose your look')", "true")
        val url = evaluate(scenario, "location.href").removeSurrounding("\"")
        assertTrue(url.startsWith(APP_ROOT))
        assertEquals(
            "android",
            evaluateAsync(scenario, "window.hungerNative.request('capabilities.get').then(value=>value.platform)"),
        )
        scenario.close()
    }

    @Test fun indexedDbSurvivesActivityRecreation() {
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        val database = "android-shell-proof-${System.nanoTime()}"
        assertEquals("true", evaluateAsync(scenario, "new Promise((resolve,reject)=>{const r=indexedDB.open('$database',1);r.onupgradeneeded=()=>r.result.createObjectStore('events');r.onsuccess=()=>{const tx=r.result.transaction('events','readwrite');tx.objectStore('events').put('event-log-is-authoritative','marker');tx.oncomplete=()=>resolve(true);};r.onerror=()=>reject(r.error);})"))
        scenario.recreate()
        assertEquals("event-log-is-authoritative", evaluateAsync(scenario, "new Promise((resolve,reject)=>{const r=indexedDB.open('$database',1);r.onsuccess=()=>{const q=r.result.transaction('events').objectStore('events').get('marker');q.onsuccess=()=>resolve(q.result);};r.onerror=()=>reject(r.error);})"))
        scenario.close()
    }

    private fun evaluate(scenario: ActivityScenario<MainActivity>, script: String): String {
        val ready = CountDownLatch(1)
        var result = ""
        scenario.onActivity { activity ->
            val webView = activity.findViewById<android.view.ViewGroup>(android.R.id.content).getChildAt(0) as WebView
            fun attempt(remaining: Int) {
                webView.evaluateJavascript("document.readyState === 'complete'") { state ->
                    if (state == "true" || remaining == 0) {
                        webView.evaluateJavascript(script) { value -> result = value; ready.countDown() }
                    } else webView.postDelayed({ attempt(remaining - 1) }, 100)
                }
            }
            attempt(100)
        }
        assertTrue("Web result timed out", ready.await(15, TimeUnit.SECONDS))
        return result
    }

    private fun evaluateAsync(scenario: ActivityScenario<MainActivity>, expression: String): String {
        val marker = "nativeTest${System.nanoTime()}"
        evaluate(scenario, "Promise.resolve($expression).then(value=>document.documentElement.dataset.$marker=JSON.stringify(value)).catch(error=>document.documentElement.dataset.$marker='error:'+error)")
        repeat(150) {
            val value = evaluate(scenario, "document.documentElement.dataset.$marker ?? ''")
            if (value != "\"\"") return value.removeSurrounding("\"").replace("\\\"", "\"").removeSurrounding("\"")
            Thread.sleep(100)
        }
        throw AssertionError("Asynchronous WebView result timed out")
    }

    private fun waitFor(scenario: ActivityScenario<MainActivity>, expression: String, expected: String) {
        var lastUrl = ""
        var lastBody = ""
        repeat(150) {
            if (evaluate(scenario, expression) == expected) return
            lastUrl = evaluate(scenario, "location.href")
            lastBody = evaluate(scenario, "document.body.innerText")
            Thread.sleep(100)
        }
        throw AssertionError("WebView condition did not become $expected: $expression; url=$lastUrl body=$lastBody")
    }
}
