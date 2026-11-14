plugins { alias(libs.plugins.android.application) }

android {
    namespace = "com.qelem.tablet"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.qelem.tablet.preview"
        minSdk = 28
        targetSdk = 36
        versionCode = 2
        versionName = "0.2-preview"
    }
}

dependencies {
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")
    testImplementation(libs.junit)
}
