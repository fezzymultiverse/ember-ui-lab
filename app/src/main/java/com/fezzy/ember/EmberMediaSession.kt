package com.fezzy.ember

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.MediaMetadata
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.Handler
import android.os.Looper
import android.webkit.WebView
import androidx.core.content.ContextCompat
import java.lang.ref.WeakReference

// V1.5.8: Android-owned now-playing session + notification for Ember's own player.
// The audio still plays in the WebView (ember_player.js). This object only mirrors what is playing into a real
// MediaSession (lock screen, headset buttons, Bluetooth) and a media notification whose buttons are real PendingIntents.
// Commands go back into the page as the window event 'ember-media-cmd' (detail: play | pause | next | prev).
object EmberMediaSession {
    private const val CHANNEL_ID = "ember_music"
    private const val NOTIF_ID = 999
    private const val ACT = "com.fezzy.ember.MEDIA_"
    private val CMDS = arrayOf("play", "pause", "next", "prev")

    private var session: MediaSession? = null
    private var receiverOn = false
    private var webRef: WeakReference<WebView>? = null

    fun attach(wv: WebView?) { if (wv != null) webRef = WeakReference(wv) }

    private fun dispatch(cmd: String) {
        if (!CMDS.contains(cmd)) return
        val wv = webRef?.get() ?: return
        val js = "window.dispatchEvent(new CustomEvent('ember-media-cmd',{detail:'" + cmd + "'}));"
        wv.post { wv.evaluateJavascript(js, null) }
    }

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(c: Context?, i: Intent?) {
            val a = i?.action ?: return
            if (a.startsWith(ACT)) dispatch(a.removePrefix(ACT))
        }
    }

    private fun init(ctx: Context) {
        val app = ctx.applicationContext
        if (session == null) {
            session = MediaSession(app, "EmberMusic").apply {
                setCallback(object : MediaSession.Callback() {
                    override fun onPlay() { dispatch("play") }
                    override fun onPause() { dispatch("pause") }
                    override fun onSkipToNext() { dispatch("next") }
                    override fun onSkipToPrevious() { dispatch("prev") }
                }, Handler(Looper.getMainLooper()))
                isActive = true
            }
        }
        if (!receiverOn) {
            val f = IntentFilter()
            CMDS.forEach { f.addAction(ACT + it) }
            ContextCompat.registerReceiver(app, receiver, f, ContextCompat.RECEIVER_NOT_EXPORTED)
            receiverOn = true
        }
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            val nm = app.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(NotificationChannel(CHANNEL_ID, "Music player", NotificationManager.IMPORTANCE_LOW))
        }
    }

    private fun pi(ctx: Context, cmd: String): PendingIntent {
        val i = Intent(ACT + cmd).setPackage(ctx.packageName)
        return PendingIntent.getBroadcast(ctx, cmd.hashCode(), i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }

    @Suppress("DEPRECATION")
    private fun action(ctx: Context, icon: Int, label: String, cmd: String): Notification.Action =
        Notification.Action.Builder(icon, label, pi(ctx, cmd)).build()

    @Suppress("DEPRECATION")
    fun updateNowPlaying(context: Context, title: String, artist: String, isPlaying: Boolean) {
        val app = context.applicationContext
        init(app)
        val s = session ?: return
        s.isActive = true
        s.setMetadata(MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, title)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, artist)
            .build())
        s.setPlaybackState(PlaybackState.Builder()
            .setActions(PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PAUSE or PlaybackState.ACTION_PLAY_PAUSE or
                PlaybackState.ACTION_SKIP_TO_NEXT or PlaybackState.ACTION_SKIP_TO_PREVIOUS)
            .setState(if (isPlaying) PlaybackState.STATE_PLAYING else PlaybackState.STATE_PAUSED, PlaybackState.PLAYBACK_POSITION_UNKNOWN, 1.0f)
            .build())

        val nm = app.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (!nm.areNotificationsEnabled()) return // the session still works; the shade card needs POST_NOTIFICATIONS on Android 13+

        val open = app.packageManager.getLaunchIntentForPackage(app.packageName)
        val openPi = if (open != null) PendingIntent.getActivity(app, 0, open, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT) else null

        val b = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) Notification.Builder(app, CHANNEL_ID) else Notification.Builder(app)
        b.setSmallIcon(R.drawable.ember_notif)
            .setContentTitle(title)
            .setContentText(artist)
            .setOnlyAlertOnce(true)
            .setOngoing(isPlaying)
            .setShowWhen(false)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .addAction(action(app, android.R.drawable.ic_media_previous, "Prev", "prev"))
            .addAction(if (isPlaying) action(app, android.R.drawable.ic_media_pause, "Pause", "pause") else action(app, android.R.drawable.ic_media_play, "Play", "play"))
            .addAction(action(app, android.R.drawable.ic_media_next, "Next", "next"))
            .setStyle(Notification.MediaStyle().setMediaSession(s.sessionToken).setShowActionsInCompactView(0, 1, 2))
        if (openPi != null) b.setContentIntent(openPi)
        nm.notify(NOTIF_ID, b.build())
    }

    fun clear(context: Context) {
        val app = context.applicationContext
        try { session?.isActive = false; session?.release() } catch (e: Exception) { /* already released */ }
        session = null
        val nm = app.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.cancel(NOTIF_ID)
    }
}
