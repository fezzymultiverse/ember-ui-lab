package com.fezzy.ember

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.RemoteInput
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

const val EMBER_CHANNEL_ID = "ember_replies"
const val EMBER_REPLY_KEY = "ember_reply_text"

@CapacitorPlugin(
    name = "EmberNotify",
    permissions = [Permission(strings = [android.Manifest.permission.POST_NOTIFICATIONS], alias = "notify")]
)
class EmberNotifyPlugin : Plugin() {

    override fun load() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val ch = NotificationChannel(EMBER_CHANNEL_ID, "Ember replies", NotificationManager.IMPORTANCE_HIGH)
            nm.createNotificationChannel(ch)
        }
    }

    @PluginMethod
    fun hasPermission(call: PluginCall) {
        val r = JSObject()
        r.put("granted", getPermissionState("notify") == com.getcapacitor.PermissionState.GRANTED)
        call.resolve(r)
    }

    @PluginMethod
    fun requestNotifyPermission(call: PluginCall) {
        requestPermissionForAlias("notify", call, "permissionCallback")
    }

    @PermissionCallback
    private fun permissionCallback(call: PluginCall) {
        hasPermission(call)
    }

    // ---- V1.5.6: battery exemption, keep-alive service, app settings ----
    @PluginMethod
    fun hasBatteryExemption(call: PluginCall) {
        val pm = context.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
        val r = JSObject()
        r.put("granted", pm.isIgnoringBatteryOptimizations(context.packageName))
        call.resolve(r)
    }

    @PluginMethod
    fun requestBatteryExemption(call: PluginCall) {
        val pm = context.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
        val r = JSObject()
        if (pm.isIgnoringBatteryOptimizations(context.packageName)) {
            r.put("granted", true); r.put("note", "Already exempt")
            call.resolve(r); return
        }
        try {
            val i = Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                .setData(android.net.Uri.parse("package:" + context.packageName))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(i)
            r.put("granted", true); r.put("note", "Confirm the system dialog")
        } catch (e: Exception) {
            try {
                val i2 = Intent(android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(i2)
                r.put("granted", true); r.put("note", "Pick Ember in the list and set it to Don't optimize")
            } catch (e2: Exception) {
                r.put("granted", false); r.put("note", e2.message ?: "Could not open battery settings")
            }
        }
        call.resolve(r)
    }

    @PluginMethod
    fun startKeepAlive(call: PluginCall) {
        val r = JSObject()
        try {
            val i = Intent(context, EmberKeepAliveService::class.java)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) context.startForegroundService(i) else context.startService(i)
            r.put("running", true)
        } catch (e: Exception) {
            r.put("running", false); r.put("note", e.message ?: "Could not start the keep-alive service")
        }
        call.resolve(r)
    }

    @PluginMethod
    fun stopKeepAlive(call: PluginCall) {
        try { context.stopService(Intent(context, EmberKeepAliveService::class.java)) } catch (e: Exception) { }
        val r = JSObject(); r.put("running", false)
        call.resolve(r)
    }

    @PluginMethod
    fun isKeepAliveRunning(call: PluginCall) {
        val r = JSObject(); r.put("running", EmberKeepAliveService.running)
        call.resolve(r)
    }

    @PluginMethod
    fun openAppSettings(call: PluginCall) {
        try {
            val i = Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                .setData(android.net.Uri.parse("package:" + context.packageName))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(i)
            call.resolve()
        } catch (e: Exception) { call.reject(e.message ?: "Could not open the app settings") }
    }

    // Posts a notification with a real inline reply box (RemoteInput).
    // Typing a reply and tapping send fires ReplyReceiver, which hands the text
    // back into the WebView as a window event — no app open required.
    @PluginMethod
    fun notify(call: PluginCall) {
        if (getPermissionState("notify") != com.getcapacitor.PermissionState.GRANTED) {
            call.reject("POST_NOTIFICATIONS not granted. Call requestNotifyPermission first.")
            return
        }
        val title = call.getString("title") ?: "Ember"
        val body = call.getString("body") ?: ""
        val id = (System.currentTimeMillis() % 100000).toInt()

        val remoteInput = RemoteInput.Builder(EMBER_REPLY_KEY).setLabel("Reply to Ember").build()
        val replyIntent = Intent(context, ReplyReceiver::class.java).setAction("com.fezzy.ember.REPLY")
        replyIntent.putExtra("ember_notif_id", id)
        val replyPendingIntent = PendingIntent.getBroadcast(
            context, id, replyIntent,
            PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val replyAction = NotificationCompat.Action.Builder(
            android.R.drawable.ic_menu_send, "Reply", replyPendingIntent
        ).addRemoteInput(remoteInput).setAllowGeneratedReplies(true).build()

        val openIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            ?: Intent(context, MainActivity::class.java)
        val openPending = PendingIntent.getActivity(
            context, id, openIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val n = NotificationCompat.Builder(context, EMBER_CHANNEL_ID)
            .setSmallIcon(R.drawable.ember_notif)
            .setContentTitle(title)
            .setContentText(body)
            .setContentIntent(openPending)
            .addAction(replyAction)
            .setAutoCancel(true)
            .build()

        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(id, n)
        call.resolve()
    }

    // ---- V1.5.8: proactive AI pings (see EmberPingWorker.kt) ----
    // The page saves what the background worker needs. An empty groqKey switches the worker off in practice and wipes the stored key.
    @PluginMethod
    fun saveNativeConfig(call: PluginCall) {
        val e = context.getSharedPreferences("EmberPrefs", Context.MODE_PRIVATE).edit()
        e.putString("groq_key", call.getString("groqKey") ?: "")
        e.putString("ping_plan", (call.getArray("plan") ?: JSArray()).toString())
        e.putString("last_chat_summary", (call.getString("summary") ?: "").take(600))
        e.putString("ping_model", call.getString("model") ?: "")
        e.putLong("last_active", call.data.optLong("lastActive", 0L))
        e.apply()
        call.resolve()
    }

    @PluginMethod
    fun setProactivePings(call: PluginCall) {
        val enabled = call.getBoolean("enabled") ?: false
        val hours = (call.getInt("hours") ?: 4).coerceIn(1, 48).toLong()
        val wm = androidx.work.WorkManager.getInstance(context)
        if (enabled) {
            val req = androidx.work.PeriodicWorkRequestBuilder<EmberPingWorker>(hours, java.util.concurrent.TimeUnit.HOURS)
                .setInitialDelay(hours, java.util.concurrent.TimeUnit.HOURS)
                .setConstraints(androidx.work.Constraints.Builder().setRequiredNetworkType(androidx.work.NetworkType.CONNECTED).build())
                .build()
            wm.enqueueUniquePeriodicWork("EmberPing", androidx.work.ExistingPeriodicWorkPolicy.UPDATE, req)
        } else {
            wm.cancelUniqueWork("EmberPing")
            context.getSharedPreferences("EmberPrefs", Context.MODE_PRIVATE).edit().remove("groq_key").remove("ping_plan").remove("last_chat_summary").apply()
        }
        val r = JSObject(); r.put("enabled", enabled); r.put("hours", hours)
        call.resolve(r)
    }

    // Runs one ping right now, ignoring quiet hours and recent use. Used by the "Send test ping" button.
    @PluginMethod
    fun pingNow(call: PluginCall) {
        val req = androidx.work.OneTimeWorkRequestBuilder<EmberPingWorker>()
            .setInputData(androidx.work.Data.Builder().putBoolean("force", true).build())
            .setConstraints(androidx.work.Constraints.Builder().setRequiredNetworkType(androidx.work.NetworkType.CONNECTED).build())
            .build()
        androidx.work.WorkManager.getInstance(context).enqueue(req)
        call.resolve()
    }
}
