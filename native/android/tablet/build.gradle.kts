plugins { alias(libs.plugins.android.application) }

android {
    namespace = "com.qelem.tablet"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.qelem.tablet.preview"
        minSdk = 28
        targetSdk = 36
        versionCode = 1
        versionName = "0.1-preview"
    }
}
