# Proguard rules for Capacitor Android
-keep public class com.getcapacitor.** { *; }
-keep public class * extends com.getcapacitor.Plugin

# Do not obfuscate web view interfaces
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep AndroidBridge and WebAppInterface
-keepclassmembers class com.amfood.manager.MainActivity$WebAppInterface {
    <methods>;
}
