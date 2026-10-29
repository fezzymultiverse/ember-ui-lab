package com.fezzy.ember

import android.Manifest
import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.os.SystemClock
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback

// V1.6.6: read-only phone facts for the Device panel. Nothing here is sent anywhere; the page only shows it.
// The Wi-Fi name is the one value Android hides behind the location permission, so it is requested only when the person taps
// "Show Wi-Fi name". Ember never reads the phone's location.
@CapacitorPlugin(
    name = "EmberDevice",
    permissions = [Permission(strings = [Manifest.permission.ACCESS_FINE_LOCATION], alias = "wifiname")]
)
class EmberDevicePlugin : Plugin() {

    @PluginMethod
    fun getInfo(call: PluginCall) {
        val r = JSObject()
        try { r.put("net", netInfo()) } catch (e: Exception) { r.put("netError", e.message ?: "network info unavailable") }
        try { r.put("mem", memInfo()) } catch (e: Exception) { r.put("memError", e.message ?: "memory info unavailable") }
        try { r.put("battery", batteryInfo()) } catch (e: Exception) { r.put("batteryError", e.message ?: "battery info unavailable") }
        r.put("uptimeMs", SystemClock.elapsedRealtime())
        r.put("model", (Build.MANUFACTURER ?: "") + " " + (Build.MODEL ?: ""))
        r.put("android", Build.VERSION.RELEASE ?: "")
        r.put("sdk", Build.VERSION.SDK_INT)
        call.resolve(r)
    }

    // V1.6.7: one-tap "Open Termux" for the EMBER TERMUX panel. Launches the app's normal launcher activity; reads nothing from it.
    @PluginMethod
    fun openApp(call: PluginCall) {
        val pkg = call.getString("package") ?: "com.termux"
        val r = JSObject()
        try {
            val i = context.packageManager.getLaunchIntentForPackage(pkg)
            if (i == null) { r.put("ok", false); r.put("error", "not installed"); call.resolve(r); return }
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(i)
            r.put("ok", true)
        } catch (e: Exception) { r.put("ok", false); r.put("error", e.message ?: "could not open") }
        call.resolve(r)
    }

    @PluginMethod
    fun requestWifiName(call: PluginCall) {
        if (getPermissionState("wifiname") == PermissionState.GRANTED) {
            val r = JSObject(); r.put("granted", true); call.resolve(r); return
        }
        requestPermissionForAlias("wifiname", call, "wifiNameCallback")
    }

    @PermissionCallback
    private fun wifiNameCallback(call: PluginCall) {
        val r = JSObject()
        r.put("granted", getPermissionState("wifiname") == PermissionState.GRANTED)
        call.resolve(r)
    }

    private fun netInfo(): JSObject {
        val o = JSObject()
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        var wifi = false; var cell = false; var vpn = false; var eth = false
        @Suppress("DEPRECATION")
        for (n in cm.allNetworks) {
            val c = cm.getNetworkCapabilities(n) ?: continue
            if (!c.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)) continue
            if (c.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) { vpn = true; continue }
            if (c.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) wifi = true
            if (c.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) cell = true
            if (c.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) eth = true
        }
        o.put("wifi", wifi); o.put("cellular", cell); o.put("ethernet", eth); o.put("vpn", vpn)
        val granted = getPermissionState("wifiname") == PermissionState.GRANTED
        o.put("wifiNameAllowed", granted)
        if (wifi && granted) {
            try {
                val wm = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
                @Suppress("DEPRECATION")
                val info = wm.connectionInfo
                var s = info?.ssid ?: ""
                if (s.length >= 2 && s.startsWith("\"") && s.endsWith("\"")) s = s.substring(1, s.length - 1)
                if (s.isEmpty() || s == "<unknown ssid>") o.put("ssidHidden", true) else o.put("ssid", s)
                if (info != null) {
                    if (info.linkSpeed > 0) o.put("linkMbps", info.linkSpeed)
                    o.put("rssi", info.rssi)
                    if (info.rssi != 0) o.put("signalLevel", WifiManager.calculateSignalLevel(info.rssi, 5))
                }
            } catch (e: Exception) { o.put("ssidHidden", true) }
        }
        return o
    }

    private fun memInfo(): JSObject {
        val o = JSObject()
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val mi = ActivityManager.MemoryInfo()
        am.getMemoryInfo(mi)
        o.put("ramTotal", mi.totalMem); o.put("ramAvail", mi.availMem); o.put("ramLow", mi.lowMemory)
        val st = StatFs(Environment.getDataDirectory().path)
        o.put("storageTotal", st.totalBytes); o.put("storageFree", st.availableBytes)
        return o
    }

    private fun batteryInfo(): JSObject {
        val o = JSObject()
        val i = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED)) ?: return o
        val level = i.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
        val scale = i.getIntExtra(BatteryManager.EXTRA_SCALE, 100)
        if (level >= 0 && scale > 0) o.put("level", Math.round(level * 100f / scale))
        val status = i.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
        o.put("charging", status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL)
        o.put("full", status == BatteryManager.BATTERY_STATUS_FULL)
        o.put("plugged", i.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) != 0)
        o.put("health", when (i.getIntExtra(BatteryManager.EXTRA_HEALTH, 0)) {
            BatteryManager.BATTERY_HEALTH_GOOD -> "good"
            BatteryManager.BATTERY_HEALTH_OVERHEAT -> "overheat"
            BatteryManager.BATTERY_HEALTH_DEAD -> "dead"
            BatteryManager.BATTERY_HEALTH_OVER_VOLTAGE -> "over_voltage"
            BatteryManager.BATTERY_HEALTH_UNSPECIFIED_FAILURE -> "failure"
            BatteryManager.BATTERY_HEALTH_COLD -> "cold"
            else -> "unknown"
        })
        val t = i.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, Int.MIN_VALUE)
        if (t != Int.MIN_VALUE) o.put("tempC", t / 10.0)
        val v = i.getIntExtra(BatteryManager.EXTRA_VOLTAGE, 0)
        if (v > 0) o.put("voltageMv", v)
        val tech = i.getStringExtra(BatteryManager.EXTRA_TECHNOLOGY)
        if (!tech.isNullOrEmpty()) o.put("technology", tech)
        // Charge cycles: Android 14+ only, and many phones do not report it. The key is written out so this compiles on older SDKs too.
        if (Build.VERSION.SDK_INT >= 34) {
            val cyc = i.getIntExtra("android.os.extra.CYCLE_COUNT", -1)
            if (cyc > 0) o.put("cycles", cyc)
            try {
                val bm = context.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
                val soh = bm.getIntProperty(10) // BATTERY_PROPERTY_STATE_OF_HEALTH (API 34)
                if (soh in 1..100) o.put("stateOfHealth", soh)
            } catch (e: Exception) { /* not reported on this phone */ }
        }
        return o
    }
}
