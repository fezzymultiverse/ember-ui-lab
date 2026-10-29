package com.fezzy.ember

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.ForegroundInfo
import androidx.work.WorkerParameters
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.schabi.newpipe.extractor.MediaFormat
import org.schabi.newpipe.extractor.ServiceList
import org.schabi.newpipe.extractor.stream.DeliveryMethod
import org.schabi.newpipe.extractor.stream.StreamInfo
import java.io.File
import java.io.FileOutputStream
import java.io.IOException

// V1.6.0: background audio download. WorkManager + coroutines, a progress notification while it runs, a normal
// notification when it ends, and the result saved to Music/Ember (visible to music apps). Never compiled or run on a phone.
class DownloadWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    private val channelId = "ember_downloads"
    private val nm get() = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    private val progressId get() = 7000 + (id.hashCode() and 0xffff)
    private val doneId get() = 90000 + (id.hashCode() and 0xffff)
    private val videoMode get() = inputData.getString("mode") == "video"
    private val saveFolder get() = if (videoMode) "Movies/Ember" else "Music/Ember"
    private var shownTitle = "YouTube audio"
    private var tagTitle = ""
    private var tagArtist = ""
    private var tagAlbum = ""
    private var tagTrack = 0
    private var lastTick = 0L
    private var lastPct = -1

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val url = inputData.getString("url") ?: return@withContext Result.failure()
        val asked = inputData.getString("title")?.trim().orEmpty()
        val tmp = File(applicationContext.cacheDir, "yt_" + id + ".part")
        try {
            report("Looking up the video...", 0, true)
            EmberYtCore.ensure()
            val svc = if (inputData.getString("service") == "soundcloud") ServiceList.SoundCloud else ServiceList.YouTube
            val info = StreamInfo.getInfo(svc, url)
            shownTitle = asked.ifEmpty { info.name ?: "YouTube audio" }
            // V1.9.27 tags: clean title, artist (given, else "Artist - Title", else the channel without "- Topic"), album (playlist name), track number.
            val parsed = splitTitle(shownTitle)
            val given = inputData.getString("artist")?.trim().orEmpty().ifEmpty { (info.uploaderName ?: "").trim() }.removeSuffix(" - Topic").trim()
            tagTitle = parsed.second
            tagArtist = if (parsed.first.isNotEmpty()) parsed.first else given
            tagAlbum = inputData.getString("album")?.trim().orEmpty()
            tagTrack = inputData.getInt("track", 0)

            // Only plain HTTP audio streams (DASH/HLS manifests are not handled). Prefer M4A, then the highest bitrate.
            val ok = info.audioStreams.filter { it.isUrl && it.deliveryMethod == DeliveryMethod.PROGRESSIVE_HTTP }
            val pick = ok.filter { it.format == MediaFormat.M4A }.maxByOrNull { it.averageBitrate }
                ?: ok.maxByOrNull { it.averageBitrate }
                ?: if (videoMode) null else throw IOException("No downloadable audio stream for this video")
            val video = if (videoMode) info.videoStreams.filter {
                it.isUrl && !it.isVideoOnly && it.deliveryMethod == DeliveryMethod.PROGRESSIVE_HTTP
            }.maxByOrNull { it.resolution.filter(Char::isDigit).toIntOrNull() ?: 0 } else null
            if (videoMode && video == null) throw IOException("No combined video/audio stream. Select yt-dlp for high-resolution merging.")
            val suffix = if (videoMode) video!!.format?.suffix ?: "mp4" else pick?.format?.suffix ?: "m4a"
            val mime = if (videoMode) video!!.format?.mimeType ?: "video/mp4" else pick?.format?.mimeType ?: "audio/mp4"

            fetch(if (videoMode) video!!.content else pick!!.content, tmp)
            report("Saving...", 100, false)
            val where = publish(tmp, safeName(shownTitle) + "." + suffix, mime)
            tmp.delete()
            remember("done", where)
            saveJob("done", 100, shownTitle, where)
            finish("Saved: $shownTitle", saveFolder)
            Result.success()
        } catch (e: CancellationException) {
            tmp.delete()
            throw e
        } catch (e: Exception) {
            tmp.delete()
            remember("failed", e.message ?: "unknown error")
            saveJob("failed", lastPct.coerceAtLeast(0), shownTitle, e.message ?: "unknown error")
            finish("Download failed: $shownTitle", e.message ?: "unknown error")
            Result.failure()
        }
    }

    // Ranged 1 MB chunks (the size Prodigy Syncing uses) (YouTube slows or cuts a single long request). If the server ignores Range it sends the whole file with 200.
    private suspend fun fetch(src: String, out: File) {
        val chunk = 1L * 1024 * 1024
        var offset = 0L
        var total = -1L
        FileOutputStream(out).use { os ->
            while (true) {
                if (isStopped) throw CancellationException("stopped")
                val req = okhttp3.Request.Builder().url(src).header("User-Agent", EmberYtCore.UA)
                    .header("Range", "bytes=$offset-${offset + chunk - 1}").build()
                var whole = false
                var done416 = false
                var got = 0L
                EmberYtCore.http.newCall(req).execute().use { r ->
                    if (r.code == 416) { done416 = true; return@use }
                    if (r.code == 429) throw IOException("YouTube rate limit (429), try again later")
                    if (!r.isSuccessful) throw IOException("YouTube answered HTTP ${r.code}")
                    val range = r.header("Content-Range")
                    if (range != null) total = range.substringAfter('/').toLongOrNull() ?: -1L
                    else if (r.code == 200) { whole = true; total = r.body?.contentLength() ?: -1L }
                    val input = r.body?.byteStream() ?: throw IOException("Empty response")
                    val buf = ByteArray(16 * 1024)
                    while (true) {
                        val n = input.read(buf)
                        if (n < 0) break
                        os.write(buf, 0, n)
                        got += n
                        offset += n
                        if (total > 0) tick(((offset * 100) / total).toInt())
                    }
                }
                if (done416) break
                if (got == 0L) throw IOException("Download stalled")
                if (whole || (total > 0 && offset >= total)) break
            }
        }
        if (offset == 0L) throw IOException("Empty download")
    }

    private suspend fun tick(pct: Int) {
        val now = System.currentTimeMillis()
        if (pct != lastPct && now - lastTick > 600) {
            lastPct = pct; lastTick = now
            report("Downloading... $pct%", pct, false)
        }
    }

    private suspend fun report(text: String, pct: Int, indeterminate: Boolean) {
        saveJob("running", pct, shownTitle, text)
        val n = build(text, pct, indeterminate)
        try {
            setForeground(if (Build.VERSION.SDK_INT >= 29)
                ForegroundInfo(progressId, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC) else ForegroundInfo(progressId, n))
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            // foreground not allowed right now (permission, background start limits): still show a normal progress notification
            try { nm.notify(progressId, n) } catch (_: Exception) { }
        }
    }

    // Per-job progress, read by EmberYoutubePlugin.status({ jobId }) for the chat cards.
    private fun saveJob(state: String, pct: Int, title: String, detail: String) {
        try {
            applicationContext.getSharedPreferences("ember_yt", Context.MODE_PRIVATE).edit()
                .putString("job_${id}_state", state).putInt("job_${id}_pct", pct)
                .putString("job_${id}_title", title).putString("job_${id}_detail", detail).apply()
        } catch (_: Exception) { /* progress is cosmetic; the download itself carries on */ }
    }

    private fun channel() {
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(NotificationChannel(channelId, "Downloads", NotificationManager.IMPORTANCE_LOW))
    }

    private fun tapIntent(): PendingIntent = PendingIntent.getActivity(
        applicationContext, 0, Intent(applicationContext, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)

    private fun build(text: String, pct: Int, indeterminate: Boolean) = run {
        channel()
        NotificationCompat.Builder(applicationContext, channelId)
            .setContentTitle("Ember download").setContentText(shownTitle + " · " + text)
            .setSmallIcon(R.drawable.ember_notif)
            .setContentIntent(tapIntent()).setOngoing(true).setOnlyAlertOnce(true)
            .setProgress(100, pct, indeterminate).build()
    }

    private fun finish(title: String, detail: String) {
        try {
            nm.cancel(progressId)
            channel()
            nm.notify(doneId, NotificationCompat.Builder(applicationContext, channelId)
                .setContentTitle(title).setContentText(detail)
                .setSmallIcon(R.drawable.ember_notif)
                .setContentIntent(tapIntent()).setAutoCancel(true).build())
        } catch (_: Exception) { /* notifications blocked: the result is still saved and readable through status() */ }
    }

    private fun remember(state: String, detail: String) {
        applicationContext.getSharedPreferences("ember_yt", Context.MODE_PRIVATE).edit()
            .putString("state", state).putString("title", shownTitle).putString("detail", detail)
            .putLong("at", System.currentTimeMillis()).apply()
    }

    // "Artist - Title (Official Video)" -> ("Artist", "Title"). Noise in brackets (official, audio, video, lyrics, visualizer, HD, 4K, explicit) is dropped.
    private fun splitTitle(raw: String): Pair<String, String> {
        val noise = Regex("\\s*[\\(\\[][^\\)\\]]*(official|audio|video|lyric|visuali[sz]er|hd|4k|explicit|music video)[^\\)\\]]*[\\)\\]]", RegexOption.IGNORE_CASE)
        val t = raw.replace(noise, "").trim().ifEmpty { raw.trim() }
        val i = t.indexOf(" - ")
        return if (i > 0 && i < t.length - 3) Pair(t.substring(0, i).trim(), t.substring(i + 3).trim()) else Pair("", t)
    }

    private fun safeName(t: String): String =
        t.replace(Regex("[\\\\/:*?\"<>|\\u0000-\\u001f]"), "_").trim().take(80).ifEmpty { "YouTube audio" }

    // Android 10+: into Music/Ember through MediaStore (no storage permission needed). Older or if that fails: app-private music folder.
    private fun publish(tmp: File, name: String, mime: String): String {
        val cr = applicationContext.contentResolver
        if (Build.VERSION.SDK_INT >= 29) {
            try {
                val cv = ContentValues().apply {
                    put(MediaStore.Audio.Media.DISPLAY_NAME, name)
                    put(MediaStore.Audio.Media.MIME_TYPE, mime)
                    if (tagTitle.isNotEmpty()) put(MediaStore.Audio.Media.TITLE, tagTitle)
                    if (!videoMode && tagArtist.isNotEmpty()) put(MediaStore.Audio.Media.ARTIST, tagArtist)
                    if (!videoMode && tagAlbum.isNotEmpty()) put(MediaStore.Audio.Media.ALBUM, tagAlbum)
                    if (!videoMode && tagTrack > 0) put(MediaStore.Audio.Media.TRACK, tagTrack)
                    put(MediaStore.Audio.Media.RELATIVE_PATH, saveFolder)
                    put(MediaStore.Audio.Media.IS_PENDING, 1)
                }
                val uri = cr.insert(if (videoMode) MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY) else MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY), cv)
                    ?: throw IOException("MediaStore refused the file")
                try { cr.openOutputStream(uri)!!.use { o -> tmp.inputStream().use { it.copyTo(o) } } } catch (e: Exception) { cr.delete(uri, null, null); throw e }
                cv.clear(); cv.put(MediaStore.Audio.Media.IS_PENDING, 0); cr.update(uri, cv, null, null)
                return "$saveFolder/$name"
            } catch (e: Exception) { /* fall through to the app folder */ }
        }
        val dir = applicationContext.getExternalFilesDir(if (videoMode) Environment.DIRECTORY_MOVIES else Environment.DIRECTORY_MUSIC) ?: applicationContext.filesDir
        val f = File(dir, name)
        tmp.copyTo(f, true)
        return f.absolutePath
    }
}
