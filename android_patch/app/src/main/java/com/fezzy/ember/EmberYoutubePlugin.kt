package com.fezzy.ember

import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequest
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.schabi.newpipe.extractor.Page
import org.schabi.newpipe.extractor.ServiceList
import org.schabi.newpipe.extractor.StreamingService
import org.schabi.newpipe.extractor.playlist.PlaylistInfo
import org.schabi.newpipe.extractor.search.SearchInfo
import org.schabi.newpipe.extractor.stream.StreamInfoItem

// V1.6.2: YouTube + SoundCloud search, playlist listing, audio download, per-job progress for the chat.
@CapacitorPlugin(name = "EmberYoutube")
class EmberYoutubePlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val ytUrl = Regex("^https://(www\\.|m\\.|music\\.)?(youtube\\.com|youtu\\.be)/\\S+$")
    private val scUrl = Regex("^https://(www\\.|m\\.)?soundcloud\\.com/\\S+$")

    private fun serviceFor(url: String): StreamingService? = when {
        ytUrl.matches(url) -> ServiceList.YouTube
        scUrl.matches(url) -> ServiceList.SoundCloud
        else -> null
    }

    private fun serviceName(url: String): String = if (scUrl.matches(url)) "soundcloud" else "youtube"

    @PluginMethod
    fun search(call: PluginCall) {
        val q = call.getString("query")?.trim().orEmpty()
        if (q.isEmpty()) { call.reject("query required"); return }
        val limit = (call.getInt("limit") ?: 5).coerceIn(1, 10)
        val soundcloud = call.getString("service") == "soundcloud"
        scope.launch {
            try {
                EmberYtCore.ensure()
                val svc: StreamingService = if (soundcloud) ServiceList.SoundCloud else ServiceList.YouTube
                val filter = if (soundcloud) "tracks" else "videos"
                val qh = svc.searchQHFactory.fromQuery(q, listOf(filter), "")
                val si = SearchInfo.getInfo(svc, qh)
                val arr = JSArray()
                for (item in si.relatedItems.filterIsInstance<StreamInfoItem>().take(limit)) {
                    arr.put(JSObject().put("title", item.name).put("url", item.url)
                        .put("channel", item.uploaderName ?: "").put("durationSec", item.duration).put("thumb", thumbOf(item)))
                }
                call.resolve(JSObject().put("results", arr))
            } catch (e: Exception) {
                call.reject(e.message ?: "Search failed")
            }
        }
    }

    // Lists the first page of a YouTube playlist or a SoundCloud set/playlist.
    @PluginMethod
    fun playlist(call: PluginCall) {
        val url = call.getString("url")?.trim().orEmpty()
        val svc = serviceFor(url) ?: run { call.reject("A YouTube or SoundCloud playlist link is required"); return }
        val limit = (call.getInt("limit") ?: 30).coerceIn(1, 100)
        scope.launch {
            try {
                EmberYtCore.ensure()
                val pi = PlaylistInfo.getInfo(svc, url)
                val arr = JSArray()
                for (item in playlistItems(svc, url, pi, limit)) {
                    arr.put(JSObject().put("title", item.name).put("url", item.url)
                        .put("artist", item.uploaderName ?: "").put("durationSec", item.duration).put("thumb", thumbOf(item)))
                }
                call.resolve(JSObject().put("title", pi.name ?: "").put("tracks", arr))
            } catch (e: Exception) {
                call.reject(e.message ?: "Could not read that playlist")
            }
        }
    }

    @PluginMethod
    fun downloadVideo(call: PluginCall) {
        val url = call.getString("url")?.trim().orEmpty()
        if (serviceFor(url) == null) { call.reject("A YouTube or SoundCloud link is required"); return }
        val req = enqueue(url, call.getString("title") ?: "", serviceName(url), call.getString("artist") ?: "", call.getString("album") ?: "", 0, call.getString("thumb") ?: "", null, call.getString("mode") ?: "audio")
        call.resolve(JSObject().put("jobId", req.id.toString()))
    }

    // Queues every track of a playlist (up to 100), each as its own download job with its own progress. Tracks of one playlist run one after
    // another (unique work queue per playlist, so a failed track never blocks the next one) and carry the playlist name as the album.
    @PluginMethod
    fun downloadPlaylist(call: PluginCall) {
        val url = call.getString("url")?.trim().orEmpty()
        val svc = serviceFor(url) ?: run { call.reject("A YouTube or SoundCloud playlist link is required"); return }
        val limit = (call.getInt("limit") ?: 30).coerceIn(1, 100)
        scope.launch {
            try {
                EmberYtCore.ensure()
                val pi = PlaylistInfo.getInfo(svc, url)
                val arr = JSArray()
                var n = 0
                val queue = "ember_pl_" + (url.hashCode().toLong() and 0xffffffffL)
                for (item in playlistItems(svc, url, pi, limit)) {
                    n++
                    val req = enqueue(item.url, item.name ?: "", serviceName(item.url), item.uploaderName ?: "", pi.name ?: "", n, thumbOf(item), queue, call.getString("mode") ?: "audio")
                    arr.put(JSObject().put("jobId", req.id.toString()).put("title", item.name ?: "").put("thumb", thumbOf(item)).put("artist", item.uploaderName ?: ""))
                }
                call.resolve(JSObject().put("title", pi.name ?: "").put("jobs", arr))
            } catch (e: Exception) {
                call.reject(e.message ?: "Could not queue that playlist")
            }
        }
    }

    private fun thumbOf(item: StreamInfoItem): String =
        try { item.thumbnails.maxByOrNull { it.height }?.url ?: "" } catch (e: Exception) { "" }

    // First page of a playlist plus further pages until `limit` tracks are collected (YouTube playlists come in pages).
    private fun playlistItems(svc: StreamingService, url: String, pi: PlaylistInfo, limit: Int): List<StreamInfoItem> {
        val items = ArrayList<StreamInfoItem>(pi.relatedItems.filterIsInstance<StreamInfoItem>())
        var page: Page? = pi.nextPage
        var guard = 0
        while (items.size < limit && page != null && guard < 10) {
            guard++
            val more = PlaylistInfo.getMoreItems(svc, url, page)
            items.addAll(more.items.filterIsInstance<StreamInfoItem>())
            page = more.nextPage
        }
        return items.take(limit)
    }

    private fun enqueue(url: String, title: String, service: String, artist: String, album: String, track: Int, thumb: String, queue: String?, mode: String): OneTimeWorkRequest {
        val data = Data.Builder().putString("url", url).putString("title", title).putString("service", service)
            .putString("mode", if (mode == "video") "video" else "audio").putString("artist", artist).putString("album", album).putInt("track", track).putString("thumb", thumb).build()
        val req = OneTimeWorkRequestBuilder<DownloadWorker>().setInputData(data).build()
        if (queue != null) WorkManager.getInstance(context).enqueueUniqueWork(queue, ExistingWorkPolicy.APPEND_OR_REPLACE, req)
        else WorkManager.getInstance(context).enqueue(req)
        return req
    }

    // With a jobId: that job's live progress (state running/done/failed, pct, title, detail).
    // Without one: the last finished download (kept for the Settings line).
    @PluginMethod
    fun status(call: PluginCall) {
        val p = context.getSharedPreferences("ember_yt", android.content.Context.MODE_PRIVATE)
        val job = call.getString("jobId")
        if (!job.isNullOrEmpty()) {
            call.resolve(JSObject()
                .put("state", p.getString("job_${job}_state", "") ?: "")
                .put("pct", p.getInt("job_${job}_pct", 0))
                .put("title", p.getString("job_${job}_title", "") ?: "")
                .put("detail", p.getString("job_${job}_detail", "") ?: ""))
            return
        }
        call.resolve(JSObject().put("state", p.getString("state", "") ?: "").put("title", p.getString("title", "") ?: "")
            .put("detail", p.getString("detail", "") ?: "").put("at", p.getLong("at", 0L)))
    }
}
