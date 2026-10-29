package com.fezzy.ember

import android.os.Bundle
import com.getcapacitor.BridgeActivity

// This is a REPLACEMENT GUESS at Capacitor 6's default template, built from your
// capacitor.config.json appId (com.fezzy.ember). Your real android/.../MainActivity.kt
// or .java was never in my hands — if it has other code in it, MERGE these in instead of overwriting:
//   1. registerPlugin(EmberMediaPlugin::class.java)
//   2. registerPlugin(EmberNotifyPlugin::class.java)
//   2b. registerPlugin(EmberAiPlugin::class.java)   (V1.5.9, background replies)
//   2c. registerPlugin(EmberYoutubePlugin::class.java)   (V1.6.0, YouTube search + audio download)
//   2d. registerPlugin(EmberDevicePlugin::class.java)   (V1.6.6, Device panel: Wi-Fi, VPN, RAM, storage, uptime, battery)
//   2e. registerPlugin(EmberWebPlugin::class.java)   (V1.8.3, real in-app browser)
//   3. the onCreate / onNewIntent body below, which reads a backgrounded reply and pushes it into the WebView as a window event.
class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(EmberMediaPlugin::class.java)
        registerPlugin(EmberNotifyPlugin::class.java)
        registerPlugin(EmberAiPlugin::class.java)
        registerPlugin(EmberYoutubePlugin::class.java)
        registerPlugin(EmberDevicePlugin::class.java)
        registerPlugin(EmberWebPlugin::class.java)
        super.onCreate(savedInstanceState)
        handleBgReply(intent)
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        handleBgReply(intent)
    }

    private fun handleBgReply(intent: android.content.Intent?) {
        val text = intent?.getStringExtra("ember_bg_reply") ?: return
        val js = "window.dispatchEvent(new CustomEvent('ember-bg-reply', {detail:" +
            org.json.JSONObject.quote(text) + "}));"
        bridge?.webView?.post { bridge.webView.evaluateJavascript(js, null) }
    }
}
