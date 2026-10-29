#!/usr/bin/env python3
"""Ember V1.6.0 - apply native Android patch to a freshly generated Capacitor 6 `android/` project.

Usage: python3 scripts/apply_android_patch.py <android_dir> <android_patch_dir>
Idempotent: safe to run on every CI build. Does:
  1. Copies the Kotlin plugins in and removes the template MainActivity.java/.kt (ours replaces it).
  2. Merges permissions, <queries> (speech recogniser visibility) and the reply <receiver> into AndroidManifest.xml.
  3. Enables Kotlin in Gradle (root classpath + app plugin + jvmTarget 17).
  4. Adds a release signingConfig fed by env KEYSTORE_PASS / KEY_ALIAS / KEY_PASS and a release.keystore next to app/build.gradle.
  4b. (V1.6.0) NewPipe Extractor + OkHttp + core-library desugaring + JitPack repo, for the YouTube audio downloader.
  5. Sets versionCode/versionName in app/build.gradle from the repo root package.json's "version"
     (e.g. "1.5.2" -> versionCode 10502, versionName "1.5.2"), so bumping package.json is enough.
Exits non-zero on anything it cannot verify, so CI fails loudly instead of shipping an APK without permissions.
"""
import os, re, shutil, sys, pathlib

if len(sys.argv) != 3:
    sys.exit('usage: apply_android_patch.py <android_dir> <android_patch_dir>')
A = pathlib.Path(sys.argv[1]); PATCH = pathlib.Path(sys.argv[2])
app = A / 'app'; manifest = app / 'src/main/AndroidManifest.xml'
for need in (manifest, app / 'build.gradle', A / 'build.gradle'):
    if not need.exists():
        sys.exit('missing ' + str(need) + ' - run `npx cap add android` first')

# ---------- 1. Kotlin sources ----------
pkg_dir = app / 'src/main/java/com/fezzy/ember'
pkg_dir.mkdir(parents=True, exist_ok=True)
for old in list((app / 'src/main/java').rglob('MainActivity.java')) + list((app / 'src/main/java').rglob('MainActivity.kt')):
    old.unlink()
src = PATCH / 'app/src/main/java/com/fezzy/ember'
kts = sorted(src.glob('*.kt'))
need_kt = {'EmberMediaPlugin.kt', 'EmberNotifyPlugin.kt', 'EmberMediaSession.kt', 'EmberPingWorker.kt', 'EmberAiPlugin.kt', 'EmberAiWorker.kt', 'EmberRouteHealth.kt', 'MainActivity.kt', 'ReplyReceiver.kt', 'EmberKeepAliveService.kt',
           'EmberYoutubePlugin.kt', 'EmberYtCore.kt', 'DownloadWorker.kt', 'EmberDevicePlugin.kt', 'EmberWebPlugin.kt'}
if not need_kt.issubset({f.name for f in kts}):
    sys.exit('missing Kotlin files in ' + str(src) + ': ' + ', '.join(sorted(need_kt - {f.name for f in kts})))
for f in kts:
    shutil.copy(f, pkg_dir / f.name)
print('copied', ', '.join(f.name for f in kts))

# ---------- 2. Manifest ----------
m = manifest.read_text()
perms = [
    ('android.permission.INTERNET', ''),
    ('android.permission.RECORD_AUDIO', ''),
    ('android.permission.CAMERA', ''),  # V1.9.30: + menu > Camera / Vision opens the camera through the file chooser
    ('android.permission.MODIFY_AUDIO_SETTINGS', ''),
    ('android.permission.POST_NOTIFICATIONS', ''),
    ('android.permission.READ_MEDIA_AUDIO', ''),  # phone music scan (Music panel > Scan phone)
    ('android.permission.READ_EXTERNAL_STORAGE', ' android:maxSdkVersion="32"'),
    ('android.permission.FOREGROUND_SERVICE', ''),
    ('android.permission.FOREGROUND_SERVICE_SPECIAL_USE', ''),
    ('android.permission.FOREGROUND_SERVICE_DATA_SYNC', ''),  # V1.6.0: YouTube download shows a foreground progress notification
    ('android.permission.WAKE_LOCK', ''),
    ('android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS', ''),
    ('android.permission.ACCESS_NETWORK_STATE', ''),  # V1.6.6 Device panel: Wi-Fi / VPN / mobile detection
    ('android.permission.ACCESS_WIFI_STATE', ''),
    ('android.permission.ACCESS_FINE_LOCATION', ''),   # V1.6.6: only so Android will reveal the Wi-Fi name; asked only when the person taps Show Wi-Fi name
]
add = ''
for name, extra in perms:
    if name not in m:
        add += '    <uses-permission android:name="%s"%s />\n' % (name, extra)
# package visibility (Android 11+): the speech recogniser, its "Speak now" dialog and the text-to-speech engine are invisible without these
q_actions = ['android.speech.RecognitionService', 'android.speech.action.RECOGNIZE_SPEECH', 'android.intent.action.TTS_SERVICE']
q_missing = [a for a in q_actions if a not in m]
if q_missing:
    q_intents = ''.join('        <intent><action android:name="%s" /></intent>\n' % a for a in q_missing)
    if '<queries>' in m:
        m = m.replace('<queries>', '<queries>\n' + q_intents.rstrip('\n'), 1)
    else:
        add += '    <queries>\n' + q_intents + '    </queries>\n'
if add:
    i = m.index('<application')
    m = m[:i] + add.lstrip(' ') + '\n    ' + m[i:]
if '.ReplyReceiver' not in m:
    m = m.replace('</application>', '    <receiver android:name=".ReplyReceiver" android:exported="false" />\n    </application>', 1)
# V1.6.0: WorkManager's own foreground service must declare a type on Android 14+, or setForeground() in DownloadWorker throws.
if 'SystemForegroundService' not in m:
    if 'xmlns:tools=' not in m:
        m, n_ns = re.subn(r'<manifest\b', '<manifest xmlns:tools="http://schemas.android.com/tools"', m, count=1)
        if n_ns == 0:
            sys.exit('manifest has no <manifest> tag')
    m = m.replace('</application>', '    <service android:name="androidx.work.impl.foreground.SystemForegroundService" android:foregroundServiceType="dataSync" tools:node="merge" />\n    </application>', 1)
if '.EmberKeepAliveService' not in m:
    svc = ('    <service android:name=".EmberKeepAliveService" android:exported="false" android:foregroundServiceType="specialUse">\n'
           '        <property android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE" android:value="Keeps the chat session alive while the user has Keep-alive switched on" />\n'
           '    </service>\n')
    m = m.replace('</application>', svc + '    </application>', 1)
# singleTask: a tap on a notification (backgrounded reply) reaches the running app through onNewIntent instead of opening a second copy.
act = re.search(r'<activity\b[^>]*>', m)
if not act:
    sys.exit('manifest has no <activity> tag')
if 'android:launchMode=' not in act.group(0):
    m = m.replace(act.group(0), act.group(0)[:-1] + ' android:launchMode="singleTask">', 1)
act = re.search(r'<activity\b[^>]*>', m)
if 'android:screenOrientation=' not in act.group(0):
    m = m.replace(act.group(0), act.group(0)[:-1] + ' android:screenOrientation="portrait">', 1)
manifest.write_text(m)
for must in ('launchMode','RECORD_AUDIO', 'MODIFY_AUDIO_SETTINGS', 'POST_NOTIFICATIONS', 'android.speech.RecognitionService', 'android.intent.action.TTS_SERVICE', '.ReplyReceiver', '.EmberKeepAliveService', 'REQUEST_IGNORE_BATTERY_OPTIMIZATIONS', 'FOREGROUND_SERVICE_SPECIAL_USE', 'FOREGROUND_SERVICE_DATA_SYNC', 'SystemForegroundService', 'INTERNET'):
    if must not in manifest.read_text():
        sys.exit('manifest merge failed: ' + must)
print('manifest merged')

# V1.9.0: Termux bridge. The page is https://localhost and the bridge is ws://127.0.0.1, so Android must allow cleartext to loopback only.
nsc = app / 'src/main/res/xml/network_security_config.xml'
nsc.parent.mkdir(parents=True, exist_ok=True)
nsc.write_text('<?xml version="1.0" encoding="utf-8"?>\n<network-security-config>\n    <domain-config cleartextTrafficPermitted="true">\n        <domain includeSubdomains="false">127.0.0.1</domain>\n        <domain includeSubdomains="false">localhost</domain>\n    </domain-config>\n</network-security-config>\n')
m = manifest.read_text()
appm = re.search(r'<application\b[^>]*>', m)
if appm and 'networkSecurityConfig' not in appm.group(0):
    tag = appm.group(0)
    new = tag[:-1] + ' android:networkSecurityConfig="@xml/network_security_config">'
    if 'usesCleartextTraffic' in tag:
        new = re.sub(r'android:usesCleartextTraffic="[^"]*"', 'android:usesCleartextTraffic="true"', new)
    m = m.replace(tag, new, 1)
    manifest.write_text(m)
print('network security config added (loopback cleartext for the Termux bridge)')

# ---------- 2b. Launcher icon (adaptive, flame mark) ----------
res_src = PATCH / 'res'
if res_src.exists():
    for f in sorted(res_src.rglob('*.xml')):
        dest = app / 'src/main/res' / f.relative_to(res_src)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(f, dest)
    print('launcher icon resources copied')

# ---------- 3. Kotlin in Gradle ----------
root = A / 'build.gradle'; r = root.read_text()
if 'kotlin-gradle-plugin' not in r:
    r2 = re.sub(r"(classpath\s+['\"]com\.android\.tools\.build:gradle:[^'\"]+['\"])", r"\1\n        classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.22'", r, count=1)
    if r2 == r:
        sys.exit('could not find AGP classpath line in android/build.gradle')
    root.write_text(r2)
# V1.6.0: NewPipe Extractor is published on JitPack only.
r = root.read_text()
if 'jitpack.io' not in r:
    r2, n_jp = re.subn(r"(allprojects\s*\{\s*repositories\s*\{)", r"\1\n        maven { url 'https://jitpack.io' }", r, count=1)
    if n_jp == 0:
        sys.exit('could not find allprojects { repositories { in android/build.gradle (needed for the JitPack repo)')
    root.write_text(r2)
g = (app / 'build.gradle'); s = g.read_text()
if "kotlin-android" not in s:
    s2 = re.sub(r"(apply plugin:\s*['\"]com\.android\.application['\"])", r"\1\napply plugin: 'kotlin-android'", s, count=1)
    if s2 == s:
        sys.exit('could not find application plugin line in app/build.gradle')
    s = s2
if 'kotlinOptions' not in s:
    s = re.sub(r"(android\s*\{)", r"\1\n    kotlinOptions { jvmTarget = '17' }", s, count=1)

# ---------- 3b. WorkManager (V1.5.8: proactive AI pings) ----------
if 'androidx.work:work-runtime-ktx' not in s:
    s2 = re.sub(r"(\n\s*dependencies\s*\{)", r'\1\n    implementation "androidx.work:work-runtime-ktx:2.9.0"', s, count=1)
    if s2 == s:
        sys.exit('could not find dependencies block in app/build.gradle')
    s = s2

# ---------- 3c. YouTube downloader (V1.6.0) ----------
# NewPipe Extractor version: $NEWPIPE_VERSION, else scripts/newpipe.version (kept fresh by .github/workflows/newpipe-update.yml), else v0.26.5.
# Same scheme and the same working version as Prodigy Syncing's CI.
_vf = pathlib.Path(__file__).resolve().parent / 'newpipe.version'
NEWPIPE_VERSION = (os.environ.get('NEWPIPE_VERSION') or (_vf.read_text().strip() if _vf.exists() else '') or 'v0.26.5').strip()
if not re.fullmatch(r'v?[0-9][0-9A-Za-z.\-]*', NEWPIPE_VERSION):
    sys.exit('bad NewPipe version: ' + NEWPIPE_VERSION)
print('NewPipeExtractor', NEWPIPE_VERSION)
def add_dep(text, marker, line):
    if marker in text:
        return text
    t2 = re.sub(r"(\n\s*dependencies\s*\{)", r'\1\n    ' + line.replace('\\', '\\\\'), text, count=1)
    if t2 == text:
        sys.exit('could not find dependencies block in app/build.gradle')
    return t2
s = add_dep(s, 'NewPipeExtractor', 'implementation "com.github.TeamNewPipe:NewPipeExtractor:%s"' % NEWPIPE_VERSION)
s = add_dep(s, 'com.squareup.okhttp3:okhttp', 'implementation "com.squareup.okhttp3:okhttp:4.12.0"')
s = add_dep(s, 'desugar_jdk_libs', 'coreLibraryDesugaring "com.android.tools:desugar_jdk_libs_nio:2.1.5"')
if 'coreLibraryDesugaringEnabled' not in s:
    if 'compileOptions' in s:
        s = re.sub(r"(compileOptions\s*\{)", r"\1\n        coreLibraryDesugaringEnabled true", s, count=1)
    else:
        s = re.sub(r"(android\s*\{)", r"\1\n    compileOptions {\n        coreLibraryDesugaringEnabled true\n        sourceCompatibility JavaVersion.VERSION_17\n        targetCompatibility JavaVersion.VERSION_17\n    }", s, count=1)

# NewPipe's dependencies ship overlapping META-INF files; without this the CI build fails with "2 files found with path META-INF/...".
if 'META-INF/DEPENDENCIES' not in s:
    s = re.sub(r"(android\s*\{)", r"\1\n    packaging { resources { excludes += ['META-INF/DEPENDENCIES', 'META-INF/LICENSE*', 'META-INF/NOTICE*', 'META-INF/INDEX.LIST'] } }", s, count=1)

# ---------- 4. Release signing ----------
if 'signingConfigs' not in s:
    block = '''
    signingConfigs {
        release {
            storeFile file('release.keystore')
            storePassword System.getenv('KEYSTORE_PASS')
            keyAlias System.getenv('KEY_ALIAS')
            keyPassword System.getenv('KEY_PASS') ?: System.getenv('KEYSTORE_PASS')
        }
    }
'''
    s2 = re.sub(r"(\n\s*buildTypes\s*\{)", block + r"\1", s, count=1)
    if s2 == s:
        sys.exit('could not find buildTypes in app/build.gradle')
    s = s2
if 'signingConfig signingConfigs.release' not in s:
    s2 = re.sub(r"(buildTypes\s*\{\s*release\s*\{)", r"\1\n            signingConfig signingConfigs.release", s, count=1)
    if s2 == s:
        sys.exit('could not find release block in buildTypes')
    s = s2
g.write_text(s)
gt = g.read_text()
for must in ('androidx.work:work-runtime-ktx', 'NewPipeExtractor', 'com.squareup.okhttp3:okhttp', 'desugar_jdk_libs_nio', 'coreLibraryDesugaringEnabled', 'META-INF/DEPENDENCIES'):
    if must not in gt:
        sys.exit('gradle patch failed: ' + must + ' missing')
if 'jitpack.io' not in root.read_text():
    sys.exit('gradle patch failed: JitPack repository missing')
print('gradle patched: kotlin + signing + workmanager + newpipe/okhttp/desugaring/jitpack')

# ---------- 5. App version (versionCode / versionName) from package.json ----------
# Keeps the APK's version in step with the web app instead of Capacitor's default (1 / "1.0").
# versionCode must be an integer that increases on every release Google Play sees; we derive it
# from package.json's semver (e.g. "1.5.2" -> 10502) so it only needs package.json bumped, not two files.
pkg_path = A.parent / 'package.json'
if not pkg_path.exists():
    sys.exit('missing ' + str(pkg_path) + ' - expected at repo root next to android/')
import json
pkg = json.loads(pkg_path.read_text())
ver = pkg.get('version', '')
m_ver = re.match(r'^(\d+)\.(\d+)\.(\d+)', ver)
if not m_ver:
    sys.exit('package.json "version" is not semver (got: ' + repr(ver) + ')')
major, minor, patch = (int(x) for x in m_ver.groups())
if minor > 99 or patch > 99:
    sys.exit('version segment out of range for versionCode scheme (minor/patch must be 0-99): ' + ver)
version_code = major * 10000 + minor * 100 + patch
g2 = g.read_text()
g2, n_code = re.subn(r'versionCode\s+\d+', 'versionCode ' + str(version_code), g2)
if n_code == 0:
    sys.exit('could not find versionCode in app/build.gradle')
g2, n_name = re.subn(r'versionName\s+"[^"]*"', 'versionName "' + ver + '"', g2)
if n_name == 0:
    sys.exit('could not find versionName in app/build.gradle')
g.write_text(g2)
print('app version set: versionCode', version_code, 'versionName', ver)
