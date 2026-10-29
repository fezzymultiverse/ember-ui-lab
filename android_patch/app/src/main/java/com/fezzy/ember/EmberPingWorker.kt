package com.fezzy.ember

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import androidx.core.app.NotificationCompat
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Calendar

// V1.5.8: opt-in proactive check-in. Runs in the background via WorkManager (survives app close and reboot).
// Reads what the page saved with EmberNotify.saveNativeConfig (Groq key + a short list of open topics), asks Groq for ONE
// short line, and posts it as a notification. Nothing is sent unless the user switched "Proactive AI Pings" on.
// Skips quiet hours (22:00-08:00) and a recently used app, unless "force" is set (the Send test ping button).
class EmberPingWorker(appContext: Context, params: WorkerParameters) : Worker(appContext, params) {

    override fun doWork(): Result {
        val force = inputData.getBoolean("force", false)
        val ctx = applicationContext
        try {
            val prefs = ctx.getSharedPreferences("EmberPrefs", Context.MODE_PRIVATE)
            val key = prefs.getString("groq_key", "") ?: ""
            val plan = try { JSONArray(prefs.getString("ping_plan","[]")) } catch (_:Exception) { JSONArray() }
            if (key.isEmpty() && plan.length() == 0) return Result.success() // switched off or no Groq key saved: nothing to do

            val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (!nm.areNotificationsEnabled()) return Result.success()

            if (!force) {
                val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
                if (hour >= 22 || hour < 8) return Result.success()
                val last = prefs.getLong("last_active", 0L)
                if (System.currentTimeMillis() - last < 30 * 60 * 1000L) return Result.success()
            }

            val topics = (prefs.getString("last_chat_summary", "") ?: "").trim()
            val model = prefs.getString("ping_model", "") ?: ""
            var text = ""
            for (i in 0 until plan.length()) {
                val p=plan.getJSONObject(i)
                if(!EmberRouteHealth.ready(ctx,p.optString("id"),p.optString("key"),p.optString("model")))continue
                text=try { askGroq(p.getString("key"),p.getString("model"),topics,p.getString("base"),p.optString("id")) } catch (_:Exception) { "" }
                if(text.isNotEmpty())break
            }
            // Older installs without a cached live model plan retain their previous Groq behavior.
            if(plan.length()==0 && key.isNotEmpty()) text=askGroq(key,if(model.isEmpty()) "llama-3.1-8b-instant" else model,topics)
            if (text.isEmpty()) return if (runAttemptCount < 2) Result.retry() else Result.success()

            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                nm.createNotificationChannel(NotificationChannel(EMBER_CHANNEL_ID, "Ember replies", NotificationManager.IMPORTANCE_HIGH))
            }
            val open = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)
            val openPi = if (open != null) PendingIntent.getActivity(ctx, 888, open, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT) else null
            // Lock screen shows only a generic line; the real text appears once the phone is unlocked.
            val publicV = NotificationCompat.Builder(ctx, EMBER_CHANNEL_ID)
                .setSmallIcon(R.drawable.ember_notif)
                .setContentTitle("Ember")
                .setContentText("Ember pinged you")
                .build()
            val n = NotificationCompat.Builder(ctx, EMBER_CHANNEL_ID)
                .setSmallIcon(R.drawable.ember_notif)
                .setContentTitle("Ember")
                .setContentText(text)
                .setStyle(NotificationCompat.BigTextStyle().bigText(text))
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setPublicVersion(publicV)
                .setAutoCancel(true)
                .apply { if (openPi != null) setContentIntent(openPi) }
                .build()
            nm.notify(888, n)
            return Result.success()
        } catch (e: Exception) {
            return if (runAttemptCount < 2) Result.retry() else Result.success()
        }
    }

    private fun askGroq(key: String, model: String, topics: String, base: String = "https://api.groq.com/openai/v1", provider: String = "groq"): String {
        val sys = "You are Ember, a warm, dry-witted companion. Write ONE short check-in message, 15 words or fewer, " +
            "that nudges the person toward a topic they were curious about. Light and curious only: never mention " +
            "health, feelings, crisis, or anything heavy, and never give advice. No quotes, no emoji, no preamble. Output only the message."
        val user = if (topics.isEmpty()) "No open topics. Just say a short, friendly hello." else "Open topics: $topics"
        val body = JSONObject().apply {
            put("model", model)
            put("messages", JSONArray()
                .put(JSONObject().put("role", "system").put("content", sys))
                .put(JSONObject().put("role", "user").put("content", user)))
            put("max_tokens", 40)
            if(provider != "puter") put("temperature", 0.8)
        }.toString()

        val started=System.currentTimeMillis()
        val conn = URL(base.trimEnd('/')+"/chat/completions").openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "POST"
            conn.connectTimeout = 15000
            conn.readTimeout = 20000
            conn.setRequestProperty("Authorization", "Bearer $key")
            conn.setRequestProperty("Content-Type", "application/json")
            conn.doOutput = true
            conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            val code=conn.responseCode
            EmberRouteHealth.record(applicationContext,provider,key,model,code,System.currentTimeMillis()-started,conn.getHeaderField("Retry-After")?.toLongOrNull() ?: 0)
            if (code != 200) return ""
            val resp = conn.inputStream.bufferedReader().use { it.readText() }
            val raw = JSONObject(resp).getJSONArray("choices").getJSONObject(0).getJSONObject("message").getString("content")
            return raw.trim().trim('"', '\'', '“', '”').trim().take(140)
        } finally {
            conn.disconnect()
        }
    }
}
