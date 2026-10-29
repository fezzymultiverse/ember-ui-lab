package com.fezzy.ember

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat

// Foreground service that keeps Ember's process alive in the background while the app is open (V1.9.8: it stops when the app is closed, it no longer restarts).
// Holds a partial CPU wake lock and shows a small ongoing notification (Android requires one for a foreground service).
// Started/stopped from JS through EmberNotifyPlugin.startKeepAlive / stopKeepAlive.
class EmberKeepAliveService : Service() {
    companion object {
        const val ACTION_STOP = "com.fezzy.ember.KEEPALIVE_STOP"
        const val CHANNEL_ID = "ember_keepalive"
        const val NOTIF_ID = 4242
        @Volatile var running = false
    }

    private var wl: PowerManager.WakeLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopForegroundCompat()
            stopSelf()
            return START_NOT_STICKY
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val ch = NotificationChannel(CHANNEL_ID, "Ember keep-alive", NotificationManager.IMPORTANCE_LOW)
            ch.setShowBadge(false)
            nm.createNotificationChannel(ch)
        }
        val open = packageManager.getLaunchIntentForPackage(packageName) ?: Intent(this, MainActivity::class.java)
        val openPi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val stopIntent = Intent(this, EmberKeepAliveService::class.java).setAction(ACTION_STOP)
        val stopPi = PendingIntent.getService(this, 1, stopIntent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val n = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ember_notif)
            .setContentTitle("Ember is staying awake")
            .setContentText("Keep-alive is on so Android does not close the app.")
            .setContentIntent(openPi)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Turn off", stopPi)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIF_ID, n)
        }
        if (wl == null) {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Ember:keepalive").apply { setReferenceCounted(false) }
        }
        try { if (wl?.isHeld == false) wl?.acquire() } catch (e: Exception) { /* no WAKE_LOCK permission: service still runs */ }
        running = true
        // V1.9.8: NOT_STICKY. START_STICKY made Android bring the service (and its notification) back after you closed the app,
        // which looked like Ember restarting by itself. It now only lives while the app does.
        return START_NOT_STICKY
    }

    // Swiped away from recents / closed: stop the service so nothing is left to restart.
    override fun onTaskRemoved(rootIntent: Intent?) {
        stopForegroundCompat()
        stopSelf()
        super.onTaskRemoved(rootIntent)
    }

    private fun stopForegroundCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(STOP_FOREGROUND_REMOVE) else @Suppress("DEPRECATION") stopForeground(true)
    }

    override fun onDestroy() {
        running = false
        try { if (wl?.isHeld == true) wl?.release() } catch (e: Exception) { }
        wl = null
        super.onDestroy()
    }
}
