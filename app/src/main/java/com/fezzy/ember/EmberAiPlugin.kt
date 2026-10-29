package com.fezzy.ember

import androidx.work.Constraints
import androidx.work.Data
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject
import java.io.File
import java.util.UUID

// V1.5.9: background chat replies. The page builds the request exactly as it always did (persona, memory, safety wrapper, history,
// the engines it would try) and, when the app goes to the background mid-reply, hands it here. EmberAiWorker finishes it even if
// the WebView is frozen or the process is killed. Local plugin, registered in MainActivity.
@CapacitorPlugin(name = "EmberAi")
class EmberAiPlugin : Plugin() {

    override fun load() { EmberAiBridge.attach(bridge.webView) }

    @PluginMethod
    fun setVisible(call: PluginCall) {
        EmberAiBridge.visible = call.getBoolean("visible") ?: false
        EmberAiBridge.attach(bridge.webView)
        call.resolve()
    }

    @PluginMethod
    fun askInBackground(call: PluginCall) {
        val turnId = call.getString("turnId")
        val msgs = call.getArray("messages")
        if (turnId.isNullOrEmpty() || msgs == null || msgs.length() == 0) { call.reject("turnId and messages are required"); return }
        try {
            val req = JSONObject()
                .put("turnId", turnId)
                .put("convId", call.getString("convId") ?: "")
                .put("system", call.getString("system") ?: "")
                .put("messages", msgs)
                .put("temp", call.data.optDouble("temp", 0.85))
                .put("max", call.data.optInt("max", 400))
                .put("plan", call.getArray("plan") ?: JSArray())
                .put("freeFirst", call.getBoolean("freeFirst") ?: false)
                .put("allowFree", call.getBoolean("allowFree") ?: false)
            val dir = File(context.filesDir, "ember_bg"); dir.mkdirs()
            val f = File(dir, UUID.randomUUID().toString() + ".json")
            f.writeText(req.toString())
            val work = OneTimeWorkRequestBuilder<EmberAiWorker>()
                .setInputData(Data.Builder().putString("path", f.absolutePath).build())
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .addTag(EmberAiBridge.tag(turnId))
                .build()
            WorkManager.getInstance(context).enqueue(work)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Could not hand the reply to the background task: " + (e.message ?: "unknown error"))
        }
    }

    // The page finished the reply itself: stop the background copy so nothing is delivered twice.
    @PluginMethod
    fun cancel(call: PluginCall) {
        val turnId = call.getString("turnId")
        if (!turnId.isNullOrEmpty()) WorkManager.getInstance(context).cancelAllWorkByTag(EmberAiBridge.tag(turnId))
        call.resolve()
    }

    @PluginMethod
    fun takeResults(call: PluginCall) {
        val r = JSObject()
        r.put("results", EmberAiBridge.take(context))
        r.put("routing", EmberRouteHealth.take(context))
        call.resolve(r)
    }
}
