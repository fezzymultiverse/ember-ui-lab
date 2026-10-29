package com.fezzy.ember

import android.app.Dialog
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.os.Build
import android.net.Uri
import android.view.Gravity
import android.view.View
import android.view.KeyEvent
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONTokener

// V1.8.3: a real browser inside Ember. A full-screen Android WebView with back, forward, reload, an address bar, a progress line and
// Ask / Save buttons. Pages run with JavaScript and cookies like any browser. Nothing from a page reaches Ember unless the person taps
// Ask or Save: then the visible text of that page is sent to the app as the "page" event (kind "ask" or "save").
// No file:// or content:// access, no downloads inside the view (they are handed to the phone's own browser).
@CapacitorPlugin(name = "EmberWeb")
class EmberWebPlugin : Plugin() {

    private var dialog: Dialog? = null
    private var web: WebView? = null
    private var urlBox: EditText? = null
    private var bar: ProgressBar? = null

    // V1.9.24: Ember theme. Black sheet, orange accents, always dark pages, and a start page for an empty address.
    private val EMBER_ORANGE = "#FF6A00"
    private val EMBER_HOME = "https://ember.local/"
    private val emberHomeHtml = ("<!doctype html><html><head><meta charset='utf-8'>" +
        "<meta name='viewport' content='width=device-width,initial-scale=1'><meta name='color-scheme' content='dark'>" +
        "<style>html,body{margin:0;height:100%;background:#000;color:#fff;font-family:sans-serif}" +
        "body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:0 20px;box-sizing:border-box}" +
        "h1{margin:0;font-size:28px;letter-spacing:1px;color:#FF6A00}p{margin:0;color:#b5b5b5;font-size:13px}" +
        "form{width:100%;max-width:420px}input{width:100%;box-sizing:border-box;background:#141414;color:#fff;border:1px solid #3a2208;" +
        "border-radius:22px;padding:12px 16px;font-size:15px;outline:none}input:focus{border-color:#FF6A00}</style></head><body>" +
        "<h1>Ember</h1><p>Search the web or paste a link above.</p>" +
        "<form action='https://duckduckgo.com/' method='get'><input name='q' placeholder='Search with DuckDuckGo' autocomplete='off'></form>" +
        "</body></html>")

    // Pages without a mobile viewport are laid out to the width of the box; wide media never pushes the page sideways.
    private val fitJs = "(function(){try{var d=document,h=d.head||d.documentElement;" +
        "if(!d.querySelector('meta[name=viewport]')){var m=d.createElement('meta');m.name='viewport';m.content='width=device-width,initial-scale=1';h.appendChild(m);}" +
        "if(!d.getElementById('ember-fit')){var s=d.createElement('style');s.id='ember-fit';" +
        "s.textContent='img,video,canvas,svg,iframe,embed,object{max-width:100%}pre{white-space:pre-wrap;word-break:break-word}';h.appendChild(s);}" +
        "}catch(e){}})();"

    private fun dp(n: Int): Int = (n * activity.resources.displayMetrics.density).toInt()

    private fun normalize(raw: String): String {
        val t = raw.trim()
        if (t.isEmpty()) return "about:blank"
        if (t.startsWith("http://") || t.startsWith("https://")) return t
        val looksLikeHost = !t.contains(" ") && t.contains(".")
        return if (looksLikeHost) "https://" + t else "https://duckduckgo.com/?q=" + Uri.encode(t)
    }

    // V1.9.2: dark pill buttons (orange for the main action) instead of the stock white Android buttons.
    private fun mkButton(label: String, primary: Boolean = false, action: () -> Unit): Button {
        val b = Button(activity)
        b.text = label
        b.isAllCaps = false
        b.minWidth = 0
        b.minimumWidth = 0
        b.minHeight = dp(40)
        b.minimumHeight = dp(40)
        b.textSize = 13f
        b.stateListAnimator = null
        b.elevation = 0f
        b.setTextColor(if (primary) Color.parseColor("#1A0800") else Color.WHITE)
        val bg = android.graphics.drawable.GradientDrawable()
        bg.cornerRadius = dp(20).toFloat()
        bg.setColor(Color.parseColor(if (primary) "#FF6A00" else "#1E1E1E"))
        bg.setStroke(dp(1), Color.parseColor(if (primary) "#FF6A00" else "#2A2A2A"))
        b.background = android.graphics.drawable.InsetDrawable(bg, dp(3), dp(4), dp(3), dp(4))
        b.setPadding(dp(14), 0, dp(14), 0)
        b.setOnClickListener { action() }
        return b
    }

    @PluginMethod
    fun open(call: PluginCall) {
        val start = normalize(call.getString("url") ?: "")
        activity.runOnUiThread {
            try {
                val existing = web
                if (dialog != null && existing != null) {
                    if (start == "about:blank") existing.loadDataWithBaseURL(EMBER_HOME, emberHomeHtml, "text/html", "utf-8", null) else existing.loadUrl(start)
                    call.resolve(JSObject().put("ok", true))
                    return@runOnUiThread
                }
                val dlg = Dialog(activity, android.R.style.Theme_DeviceDefault_NoActionBar)
                val root = LinearLayout(activity)
                root.orientation = LinearLayout.VERTICAL
                val sheetBg = android.graphics.drawable.GradientDrawable()
                val rad = dp(20).toFloat()
                sheetBg.cornerRadii = floatArrayOf(rad, rad, rad, rad, 0f, 0f, 0f, 0f)
                sheetBg.setColor(Color.BLACK)
                sheetBg.setStroke(dp(1), Color.parseColor("#3A2208"))
                root.background = sheetBg
                root.setOnApplyWindowInsetsListener { v, ins ->
                    val nav = if (Build.VERSION.SDK_INT >= 30) ins.getInsets(WindowInsets.Type.navigationBars()).bottom else 0
                    v.setPadding(0, 0, 0, nav)
                    ins
                }
                val grab = View(activity)
                val grabBg = android.graphics.drawable.GradientDrawable()
                grabBg.cornerRadius = dp(2).toFloat()
                grabBg.setColor(Color.parseColor(EMBER_ORANGE))
                grab.background = grabBg

                // V1.9.24: a dark-theme context so Android's automatic page darkening is allowed (the app's own theme is light)
                val view = WebView(android.view.ContextThemeWrapper(activity, android.R.style.Theme_DeviceDefault))
                view.setBackgroundColor(Color.parseColor("#0A0A0A"))
                val st = view.settings
                if (Build.VERSION.SDK_INT >= 33) {
                    st.setAlgorithmicDarkeningAllowed(true)
                } else if (Build.VERSION.SDK_INT >= 29) {
                    @Suppress("DEPRECATION")
                    st.setForceDark(WebSettings.FORCE_DARK_ON)
                }
                st.javaScriptEnabled = true
                st.domStorageEnabled = true
                st.allowFileAccess = false
                st.allowContentAccess = false
                st.setSupportZoom(true)
                st.builtInZoomControls = true
                st.displayZoomControls = false
                st.loadWithOverviewMode = true
                st.useWideViewPort = true
                st.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
                CookieManager.getInstance().setAcceptCookie(true)
                CookieManager.getInstance().setAcceptThirdPartyCookies(view, true)

                val addr = EditText(activity)
                addr.setSingleLine(true)
                addr.hint = "Search or paste a link"
                addr.setTextColor(Color.WHITE)
                addr.setHintTextColor(Color.GRAY)
                val abg = android.graphics.drawable.GradientDrawable()
                abg.cornerRadius = dp(20).toFloat()
                abg.setColor(Color.parseColor("#1E1E1E"))
                abg.setStroke(dp(1), Color.parseColor("#3A2208"))
                addr.background = abg
                addr.setOnFocusChangeListener { _, focused ->
                    abg.setStroke(dp(1), Color.parseColor(if (focused) EMBER_ORANGE else "#3A2208"))
                }
                addr.setPadding(dp(14), dp(8), dp(14), dp(8))
                addr.imeOptions = EditorInfo.IME_ACTION_GO
                addr.setOnEditorActionListener { _, actionId, _ ->
                    if (actionId == EditorInfo.IME_ACTION_GO) {
                        view.loadUrl(normalize(addr.text.toString()))
                        true
                    } else {
                        false
                    }
                }

                val progress = ProgressBar(activity, null, android.R.attr.progressBarStyleHorizontal)
                progress.max = 100
                progress.visibility = View.GONE
                progress.progressTintList = ColorStateList.valueOf(Color.parseColor(EMBER_ORANGE))
                progress.progressBackgroundTintList = ColorStateList.valueOf(Color.parseColor("#1A1A1A"))

                view.webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(v: WebView, request: WebResourceRequest): Boolean {
                        val scheme = request.url.scheme ?: ""
                        if (scheme == "http" || scheme == "https") return false
                        return true // intent:, market:, file: and everything else stays blocked inside the view
                    }

                    override fun onPageStarted(v: WebView, url: String?, favicon: android.graphics.Bitmap?) {
                        if (url != null) addr.setText(if (url.startsWith(EMBER_HOME)) "" else url)
                    }

                    override fun onPageCommitVisible(v: WebView, url: String?) {
                        v.evaluateJavascript(fitJs, null)
                    }

                    override fun onPageFinished(v: WebView, url: String?) {
                        if (url != null) addr.setText(if (url.startsWith(EMBER_HOME)) "" else url)
                        v.evaluateJavascript(fitJs, null)
                        val ev = JSObject()
                        ev.put("url", url ?: "")
                        ev.put("title", v.title ?: "")
                        notifyListeners("loaded", ev)
                    }
                }
                view.webChromeClient = object : WebChromeClient() {
                    override fun onProgressChanged(v: WebView, newProgress: Int) {
                        progress.progress = newProgress
                        progress.visibility = if (newProgress in 1..99) View.VISIBLE else View.GONE
                    }
                }
                view.setDownloadListener { dlUrl, _, _, _, _ ->
                    try {
                        val i = Intent(Intent.ACTION_VIEW, Uri.parse(dlUrl))
                        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        activity.startActivity(i)
                    } catch (e: Exception) {
                        // no app can take this download: nothing to do
                    }
                }

                val top = LinearLayout(activity)
                top.orientation = LinearLayout.HORIZONTAL
                top.gravity = Gravity.CENTER_VERTICAL
                top.addView(mkButton("←") { if (view.canGoBack()) view.goBack() })
                top.addView(mkButton("→") { if (view.canGoForward()) view.goForward() })
                top.addView(mkButton("⟳") { view.reload() })
                top.addView(addr, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
                top.addView(mkButton("✕") { closeDialog() })

                val bottom = LinearLayout(activity)
                bottom.orientation = LinearLayout.HORIZONTAL
                bottom.gravity = Gravity.CENTER
                bottom.addView(mkButton("Ask Ember", true) { sendPage("ask") })
                bottom.addView(mkButton("Save to Documents") { sendPage("save") })
                bottom.addView(mkButton("Open in Chrome") {
                    try {
                        val i = Intent(Intent.ACTION_VIEW, Uri.parse(view.url ?: start))
                        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        activity.startActivity(i)
                    } catch (e: Exception) {
                        // no browser app found
                    }
                })

                val grabLp = LinearLayout.LayoutParams(dp(36), dp(4))
                grabLp.gravity = Gravity.CENTER_HORIZONTAL
                grabLp.topMargin = dp(6)
                grabLp.bottomMargin = dp(2)
                root.addView(grab, grabLp)
                root.addView(top, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
                root.addView(progress, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3)))
                root.addView(view, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
                root.addView(bottom, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

                dlg.setContentView(root)
                dlg.window?.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
                dlg.setOnKeyListener { _, keyCode, event ->
                    if (keyCode == KeyEvent.KEYCODE_BACK && event.action == KeyEvent.ACTION_UP) {
                        if (view.canGoBack()) view.goBack() else closeDialog()
                        true
                    } else {
                        false
                    }
                }
                dlg.setOnDismissListener {
                    web?.stopLoading()
                    web?.destroy()
                    web = null
                    dialog = null
                    urlBox = null
                    bar = null
                    notifyListeners("closed", JSObject())
                }
                dialog = dlg
                web = view
                urlBox = addr
                bar = progress
                // V1.9.2: medium bottom sheet (about 62% of the screen) instead of full screen, so chat stays visible above it.
                val screenH = activity.resources.displayMetrics.heightPixels
                dlg.window?.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, (screenH * 0.62f).toInt())
                dlg.window?.setGravity(Gravity.BOTTOM)
                dlg.window?.setBackgroundDrawable(android.graphics.drawable.ColorDrawable(Color.TRANSPARENT))
                dlg.show()
                if (start == "about:blank") view.loadDataWithBaseURL(EMBER_HOME, emberHomeHtml, "text/html", "utf-8", null) else view.loadUrl(start)
                call.resolve(JSObject().put("ok", true))
            } catch (e: Exception) {
                call.reject(e.message ?: "could not open the browser")
            }
        }
    }

    @PluginMethod
    fun close(call: PluginCall) {
        activity.runOnUiThread {
            closeDialog()
            call.resolve(JSObject().put("ok", true))
        }
    }

    private fun closeDialog() {
        try {
            dialog?.dismiss()
        } catch (e: Exception) {
            // already gone
        }
    }

    // Reads the visible text of the page and hands it to the app. Only runs when the person taps Ask or Save.
    private fun sendPage(kind: String) {
        val view = web ?: return
        view.evaluateJavascript("(function(){return document.body?document.body.innerText:'';})()") { raw ->
            var text = ""
            try {
                val v = JSONTokener(raw ?: "null").nextValue()
                if (v is String) text = v
            } catch (e: Exception) {
                text = ""
            }
            if (text.length > 60000) text = text.substring(0, 60000)
            val ev = JSObject()
            ev.put("kind", kind)
            ev.put("url", view.url ?: "")
            ev.put("title", view.title ?: "")
            ev.put("text", text)
            notifyListeners("page", ev)
            closeDialog()
        }
    }

    override fun handleOnDestroy() {
        closeDialog()
        super.handleOnDestroy()
    }
}
