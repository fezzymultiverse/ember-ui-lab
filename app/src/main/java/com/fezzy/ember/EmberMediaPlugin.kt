package com.fezzy.ember

import android.content.ContentUris
import android.provider.MediaStore
import android.util.Base64
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

// Local (unpublished) Capacitor plugin. Registered manually in MainActivity, not via `cap sync`.
// Gives Ember's own player (www/ember_player.js) access to the audio files Android has indexed:
//   getLibrary  -> list of tracks (id, title, artist, album, duration, size, mime)
//   readChunk   -> raw bytes of one track, base64, in small pieces (a content:// file cannot be loaded by the WebView directly)
// Playback itself happens in the WebView. Nothing here talks to any other app.
@CapacitorPlugin(
    name = "EmberMedia",
    permissions = [
        Permission(strings = [android.Manifest.permission.READ_MEDIA_AUDIO], alias = "music"),
        Permission(strings = [android.Manifest.permission.READ_EXTERNAL_STORAGE], alias = "storage")
    ]
)
class EmberMediaPlugin : Plugin() {

    // Android 13+ has the audio-only permission; older versions use the old storage permission.
    private fun alias(): String =
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) "music" else "storage"

    private fun granted(): Boolean = getPermissionState(alias()) == PermissionState.GRANTED

    @PluginMethod
    fun hasPermission(call: PluginCall) {
        val ok = granted()
        val r = JSObject()
        r.put("granted", ok)
        if (!ok) r.put("note", "Music and audio access not granted yet")
        call.resolve(r)
    }

    @PluginMethod
    fun requestMusicPermission(call: PluginCall) {
        if (granted()) { hasPermission(call); return }
        requestPermissionForAlias(alias(), call, "permissionCallback")
    }

    @PermissionCallback
    private fun permissionCallback(call: PluginCall) {
        hasPermission(call)
    }

    @PluginMethod
    fun getLibrary(call: PluginCall) {
        if (!granted()) {
            call.reject("Music and audio access not granted. Call requestMusicPermission first.")
            return
        }
        val tracks = JSArray()
        val projection = arrayOf(
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.TITLE,
            MediaStore.Audio.Media.ARTIST,
            MediaStore.Audio.Media.ALBUM,
            MediaStore.Audio.Media.DURATION,
            MediaStore.Audio.Media.SIZE,
            MediaStore.Audio.Media.MIME_TYPE
        )
        val selection = MediaStore.Audio.Media.IS_MUSIC + " != 0"
        try {
            context.contentResolver.query(
                MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, projection, selection, null,
                MediaStore.Audio.Media.TITLE + " ASC"
            )?.use { c ->
                val idI = c.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
                val tI = c.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)
                val aI = c.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
                val alI = c.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM)
                val dI = c.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION)
                val sI = c.getColumnIndexOrThrow(MediaStore.Audio.Media.SIZE)
                val mI = c.getColumnIndexOrThrow(MediaStore.Audio.Media.MIME_TYPE)
                while (c.moveToNext()) {
                    val t = JSObject()
                    t.put("id", c.getLong(idI).toString())
                    t.put("title", c.getString(tI) ?: "")
                    t.put("artist", c.getString(aI) ?: "")
                    t.put("album", c.getString(alI) ?: "")
                    t.put("durationMs", c.getLong(dI))
                    t.put("size", c.getLong(sI))
                    t.put("mime", c.getString(mI) ?: "")
                    tracks.put(t)
                }
            }
        } catch (e: Exception) {
            call.reject("Could not read the music library: " + (e.message ?: "unknown error"))
            return
        }
        val r = JSObject()
        r.put("tracks", tracks)
        call.resolve(r)
    }

    @PluginMethod
    fun readChunk(call: PluginCall) {
        if (!granted()) {
            call.reject("Music and audio access not granted.")
            return
        }
        val id = call.getString("id")?.toLongOrNull()
        if (id == null) {
            call.reject("id is required")
            return
        }
        val offset = (call.getDouble("offset") ?: 0.0).toLong()
        val length = (call.getDouble("length") ?: 786432.0).toInt().coerceIn(1, 1048576)
        if (offset < 0) {
            call.reject("offset must not be negative")
            return
        }
        val uri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id)
        try {
            val pfd = context.contentResolver.openFileDescriptor(uri, "r")
            if (pfd == null) {
                call.reject("Could not open that file.")
                return
            }
            pfd.use { p ->
                val total = p.statSize
                java.io.FileInputStream(p.fileDescriptor).use { fis ->
                    fis.channel.position(offset)
                    val buf = ByteArray(length)
                    var read = 0
                    while (read < length) {
                        val n = fis.read(buf, read, length - read)
                        if (n < 0) break
                        read += n
                    }
                    val r = JSObject()
                    r.put("data", Base64.encodeToString(buf, 0, read, Base64.NO_WRAP))
                    r.put("eof", read < length || (total >= 0 && offset + read >= total))
                    r.put("size", total)
                    call.resolve(r)
                }
            }
        } catch (e: Exception) {
            call.reject("Could not read that file: " + (e.message ?: "unknown error"))
        }
    }

    // ---- V1.5.8: native now-playing session + notification (see EmberMediaSession.kt) ----
    @PluginMethod
    fun updateNotification(call: PluginCall) {
        val title = call.getString("title") ?: "Unknown track"
        val artist = call.getString("artist") ?: ""
        val isPlaying = call.getBoolean("isPlaying") ?: false
        try {
            EmberMediaSession.attach(bridge.webView)
            EmberMediaSession.updateNowPlaying(context, title, artist, isPlaying)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Could not update the music notification: " + (e.message ?: "unknown error"))
        }
    }

    @PluginMethod
    fun clearNotification(call: PluginCall) {
        try { EmberMediaSession.clear(context) } catch (e: Exception) { /* nothing was showing */ }
        call.resolve()
    }
}
