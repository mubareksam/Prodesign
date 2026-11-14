plugins { alias(libs.plugins.android.application) }

android {
    namespace = "com.qelem.tablet"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.qelem.tablet.preview"
        minSdk = 28
        targetSdk = 36
        versionCode = 5
        versionName = "0.5-preview"
    }
}

dependencies {
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")
    // ZXing CaptureManager uses AndroidX core at runtime; its old Maven metadata may omit it.
    implementation(libs.androidx.core.ktx)
    testImplementation(libs.junit)
}
