package com.fezzy.ember

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.webkit.WebView
import androidx.core.app.NotificationCompat
import androidx.core.app.RemoteInput
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.lang.ref.WeakReference
import java.net.HttpURLConnection
import java.net.URL

// V1.5.9: shared state between EmberAiPlugin (page side) and EmberAiWorker (background side).
object EmberAiBridge {
    @Volatile var visible = false          // set by the page: true while Ember is on screen
    private var webRef: WeakReference<WebView>? = null
    private const val PREFS = "EmberBg"
    private const val KEY = "results"

    fun attach(wv: WebView?) { if (wv != null) webRef = WeakReference(wv) }

    // Tells a live page that a result is waiting. The page then calls takeResults() itself, so nothing is lost if the page is not there.
    fun poke() {
        val wv = webRef?.get() ?: return
        wv.post { wv.evaluateJavascript("window.dispatchEvent(new Event('ember-bg-ready'));", null) }
    }

    fun tag(turnId: String) = "ember_ai_" + Integer.toHexString(turnId.hashCode())

    @Synchronized fun put(ctx: Context, r: JSONObject) {
        val sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val a = try { JSONArray(sp.getString(KEY, "[]")) } catch (e: Exception) { JSONArray() }
        a.put(r)
        val out = JSONArray()
        for (i in maxOf(0, a.length() - 20) until a.length()) out.put(a.get(i))
        sp.edit().putString(KEY, out.toString()).apply()
    }

    @Synchronized fun take(ctx: Context): JSONArray {
        val sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val a = try { JSONArray(sp.getString(KEY, "[]")) } catch (e: Exception) { JSONArray() }
        sp.edit().remove(KEY).apply()
        return a
    }
}

// Runs one chat request that the page already built (system prompt, history, provider plan). Survives the WebView being frozen or the
// process being killed, because WorkManager restarts it. The answer is stored for the page to pick up and shown as a notification
// with an inline reply box (the existing ReplyReceiver turns that reply back into a normal chat message).
class EmberAiWorker(appContext: Context, params: WorkerParameters) : Worker(appContext, params) {

    override fun doWork(): Result {
        val ctx = applicationContext
        val path = inputData.getString("path") ?: return Result.failure()
        val f = File(path)
        if (!f.exists()) return Result.success() // cancelled, or already delivered
        val req = try { JSONObject(f.readText()) } catch (e: Exception) { f.delete(); return Result.failure() }
        val turnId = req.optString("turnId")

        val got = try { generate(req) } catch (e: Exception) { null }
        if (got == null) {
            // Do not blindly repeat a whole billable plan after a timeout or server failure.
            f.delete()
            notifyText(ctx, "I could not finish that reply in the background. Open Ember to try again.", turnId)
            return Result.success()
        }
        f.delete() // the request held the API keys: remove it as soon as it is done

        val text = got.getString("text")
        EmberAiBridge.put(ctx, JSONObject().put("turnId", turnId).put("convId", req.optString("convId")).put("text", text)
            .put("provider", got.optString("provider")).put("model", got.optString("model")))
        if (!EmberAiBridge.visible) notifyText(ctx, text, turnId)
        EmberAiBridge.poke()
        return Result.success()
    }

    private fun clean(t: String): String =
        t.replace(Regex("<tool_call>[\\s\\S]*?</tool_call>", RegexOption.IGNORE_CASE), "").replace(Regex("</?tool_call>", RegexOption.IGNORE_CASE), "").trim()

    private fun post(url: String, key: String?, body: String, provider: String = "pollinations", model: String = "openai"): String? {
        if (key != null && !EmberRouteHealth.ready(applicationContext,provider,key,model)) return null
        val started = System.currentTimeMillis()
        val c = URL(url).openConnection() as HttpURLConnection
        try {
            c.requestMethod = "POST"; c.connectTimeout = 15000; c.readTimeout = 45000
            c.setRequestProperty("Content-Type", "application/json")
            if (!key.isNullOrEmpty()) c.setRequestProperty("Authorization", "Bearer $key")
            c.doOutput = true
            c.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            val status = c.responseCode
            if (key != null) {
                val header = c.getHeaderField("Retry-After")
                val retry = header?.toLongOrNull() ?: try { maxOf(1L,(java.text.SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss z",java.util.Locale.US).parse(header ?: "")!!.time-System.currentTimeMillis())/1000L) } catch (_:Exception) { 0L }
                EmberRouteHealth.record(applicationContext,provider,key,model,status,System.currentTimeMillis()-started,retry)
            }
            if (status != 200) return null
            val j = JSONObject(c.inputStream.bufferedReader().use { it.readText() })
            return j.getJSONArray("choices").getJSONObject(0).getJSONObject("message").getString("content")
        } finally { c.disconnect() }
    }

    // Mirrors the page's router: free engine first when the page said so, then the planned keyed engines, then the free engine as the last resort.
    private fun generate(req: JSONObject): JSONObject? {
        val msgs = JSONArray().put(JSONObject().put("role", "system").put("content", req.optString("system")))
        val m = req.getJSONArray("messages")
        for (i in 0 until m.length()) msgs.put(m.get(i))
        val temp = req.optDouble("temp", 0.85)
        val max = req.optInt("max", 400)
        val plan = req.optJSONArray("plan") ?: JSONArray()

        fun viaPlan(): JSONObject? {
            for (i in 0 until plan.length()) {
                val p = plan.getJSONObject(i)
                val requestBody = JSONObject().put("model", p.getString("model")).put("messages", msgs).put("max_tokens", max)
                if (p.optString("id") != "puter") requestBody.put("temperature", temp)
                val body = requestBody.toString()
                try {
                    val t = post(p.getString("base").trimEnd('/') + "/chat/completions", p.getString("key"), body, p.optString("id"), p.getString("model"))
                    val c = if (t == null) "" else clean(t)
                    if (c.isNotEmpty()) return JSONObject().put("text", c).put("provider", p.optString("id")).put("model", p.getString("model"))
                } catch (e: Exception) { /* next engine */ }
            }
            return null
        }
        fun viaFree(): JSONObject? {
            if (!req.optBoolean("allowFree", false)) return null
            return try {
                val body = JSONObject().put("model", "openai").put("messages", msgs).toString()
                val t = post("https://text.pollinations.ai/openai", null, body)
                val c = if (t == null) "" else clean(t)
                if (c.isEmpty()) null else JSONObject().put("text", c).put("provider", "pollinations").put("model", "openai")
            } catch (e: Exception) { null }
        }
        return if (req.optBoolean("freeFirst", false)) (viaFree() ?: viaPlan()) else (viaPlan() ?: viaFree())
    }

    private fun notifyText(ctx: Context, text: String, turnId: String) {
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (!nm.areNotificationsEnabled()) return
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            nm.createNotificationChannel(NotificationChannel(EMBER_CHANNEL_ID, "Ember replies", NotificationManager.IMPORTANCE_HIGH))
        }
        val id = 1000 + (turnId.hashCode() and 0x7FFF)
        val remoteInput = RemoteInput.Builder(EMBER_REPLY_KEY).setLabel("Reply to Ember").build()
        val replyIntent = Intent(ctx, ReplyReceiver::class.java).setAction("com.fezzy.ember.REPLY").putExtra("ember_notif_id", id)
        val replyPi = PendingIntent.getBroadcast(ctx, id, replyIntent, PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val replyAction = NotificationCompat.Action.Builder(android.R.drawable.ic_menu_send, "Reply", replyPi)
            .addRemoteInput(remoteInput).setAllowGeneratedReplies(true).build()
        val open = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)
        val openPi = if (open != null) PendingIntent.getActivity(ctx, id, open, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT) else null
        val publicV = NotificationCompat.Builder(ctx, EMBER_CHANNEL_ID).setSmallIcon(R.drawable.ember_notif)
            .setContentTitle("Ember").setContentText("New reply").build()
        val n = NotificationCompat.Builder(ctx, EMBER_CHANNEL_ID)
            .setSmallIcon(R.drawable.ember_notif)
            .setContentTitle("Ember")
            .setContentText(text.take(120))
            .setStyle(NotificationCompat.BigTextStyle().bigText(text.take(600)))
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setPublicVersion(publicV)
            .addAction(replyAction)
            .setAutoCancel(true)
            .apply { if (openPi != null) setContentIntent(openPi) }
            .build()
        nm.notify(id, n)
    }
}
