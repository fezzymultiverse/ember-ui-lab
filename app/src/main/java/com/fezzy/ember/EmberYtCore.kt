package com.fezzy.ember

import okhttp3.OkHttpClient
import okhttp3.RequestBody.Companion.toRequestBody
import org.schabi.newpipe.extractor.NewPipe
import org.schabi.newpipe.extractor.downloader.Downloader
import org.schabi.newpipe.extractor.downloader.Request
import org.schabi.newpipe.extractor.downloader.Response
import org.schabi.newpipe.extractor.exceptions.ReCaptchaException
import org.schabi.newpipe.extractor.localization.ContentCountry
import org.schabi.newpipe.extractor.localization.Localization
import java.util.concurrent.TimeUnit

// V1.6.0: shared NewPipe setup. NewPipe.init() MUST run (with a Downloader) before any extractor call, or every lookup throws.
// The upgrade plan left this out. Setup, Downloader and locale mirror Prodigy Syncing's YtFetch.java, which already builds and downloads.
object EmberYtCore {
    const val UA = "Mozilla/5.0 (Windows NT 10.0; rv:128.0) Gecko/20100101 Firefox/128.0"

    val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private var ready = false

    @Synchronized
    fun ensure() {
        if (!ready) {
            NewPipe.init(Dl, Localization("en", "US"), ContentCountry("US"))
            ready = true
        }
    }

    private object Dl : Downloader() {
        override fun execute(request: Request): Response {
            val method = request.httpMethod()
            val data = request.dataToSend()
            val body = when {
                data != null -> data.toRequestBody()
                method == "POST" || method == "PUT" -> ByteArray(0).toRequestBody()
                else -> null
            }
            val b = okhttp3.Request.Builder().method(method, body).url(request.url()).header("User-Agent", UA)
            for ((name, values) in request.headers()) {
                b.removeHeader(name)
                for (v in values) b.addHeader(name, v)
            }
            http.newCall(b.build()).execute().use { r ->
                if (r.code == 429) throw ReCaptchaException("reCaptcha challenge requested", request.url())
                return Response(r.code, r.message, r.headers.toMultimap(), r.body?.string(), r.request.url.toString())
            }
        }
    }
}
