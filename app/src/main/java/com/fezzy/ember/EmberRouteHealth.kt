package com.fezzy.ember

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest

/** Native jobs share credential/model cooldowns. Metrics contain masked keys, never credentials. */
object EmberRouteHealth {
    private fun prefs(ctx: Context) = ctx.getSharedPreferences("EmberRouteHealth", Context.MODE_PRIVATE)
    private fun hash(id: String, key: String, model: String): String = MessageDigest.getInstance("SHA-256")
        .digest("$id\u0000$key\u0000$model".toByteArray()).joinToString("") { "%02x".format(it.toInt() and 255) }
    @Synchronized fun ready(ctx: Context, id: String, key: String, model: String): Boolean {
        val p = prefs(ctx); val now = System.currentTimeMillis()
        return p.getLong(hash(id, key, "*"), 0L) <= now && p.getLong(hash(id, key, model), 0L) <= now
    }
    @Synchronized fun record(ctx: Context, id: String, key: String, model: String, status: Int, ms: Long, retry: Long = 0) {
        val p = prefs(ctx); val edit = p.edit(); val now = System.currentTimeMillis()
        val seconds = if (retry > 0) retry else if (status == 429) 60L else 30L
        val until = now + seconds.coerceIn(1L, 31536000L) * 1000L
        if (status == 401) edit.putLong(hash(id,key,"*"), now + 86400000L)
        else if (status == 402) edit.putLong(hash(id,key,"*"), now + maxOf(seconds,300L)*1000L)
        else if (status == 429 || status == 403 || status == 404 || status >= 500 || status == 0) edit.putLong(hash(id,key,model),until)
        val rows = try { JSONArray(p.getString("events","[]")) } catch (_: Exception) { JSONArray() }
        val masked = if(key.length > 12) key.take(6)+"…"+key.takeLast(4) else key.take(3)+"…"
        rows.put(JSONObject().put("id",id).put("key",masked).put("model",model).put("status",status).put("ms",ms).put("at",now).put("retry",if(status==429)seconds else 0))
        val bounded=JSONArray(); for(i in maxOf(0,rows.length()-100) until rows.length()) bounded.put(rows.get(i))
        edit.putString("events",bounded.toString()).apply()
    }
    @Synchronized fun take(ctx: Context): JSONArray {
        val p=prefs(ctx); val rows=try { JSONArray(p.getString("events","[]")) } catch(_:Exception){JSONArray()}
        p.edit().remove("events").apply(); return rows
    }
}
