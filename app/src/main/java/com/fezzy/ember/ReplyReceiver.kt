package com.fezzy.ember

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.RemoteInput

// Fires when the user types into the notification reply box and hits send.
// Needs MainActivity to have a live Bridge for evaluateJavascript to land —
// if the app process is dead, the OS still runs this receiver but the WebView
// is not loaded, so EmberApp.onBackgroundReply is only called when it can be.
class ReplyReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val input = RemoteInput.getResultsFromIntent(intent)?.getCharSequence(EMBER_REPLY_KEY)?.toString() ?: return

        val mainIntent = Intent(context, MainActivity::class.java)
        mainIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
        mainIntent.putExtra("ember_bg_reply", input)
        context.startActivity(mainIntent)

        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val id = intent.getIntExtra("ember_notif_id", -1)
        if (id != -1) nm.cancel(id)
    }
}
