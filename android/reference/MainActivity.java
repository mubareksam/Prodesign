// Reference Java mirror of android/smali/com/qalam/studio/MainActivity.smali
// Not shipped in the APK: it exists so the build script can type-check every
// Android API call used by the hand-written smali against a real android.jar
// (javac from the OpenJDK tools.jar, see tools/check_reference.sh).
package com.qalam.studio;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.ValueCallback;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private Bridge bridge;
    private WebView web;
    private ValueCallback<Uri[]> imageCallback;
    private static final int IMAGE_REQUEST = 4201;

    public MainActivity() {
    }

    private void hideSystemUi() {
        Window w = getWindow();                       // Activity.getWindow()
        View decor = w.getDecorView();                // Window.getDecorView()
        decor.setSystemUiVisibility(0x101f);          // SYSTEM_UI_FLAG_* combination
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        hideSystemUi();
        getWindow().addFlags(0x80);                   // FLAG_KEEP_SCREEN_ON

        bridge = new Bridge(this);

        web = new WebView(this);
        web.setBackgroundColor(0xff101014);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setSupportMultipleWindows(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100);

        web.addJavascriptInterface(bridge, "QalamNative");
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new PickerChrome(this));
        web.setOverScrollMode(2);                     // OVER_SCROLL_NEVER
        web.setHapticFeedbackEnabled(true);
        web.loadUrl("file:///android_asset/app/index.html");
        setContentView(web);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) {
            web.onResume();
        }
        hideSystemUi();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) {
            web.onPause();
        }
    }

    public boolean chooseImage(ValueCallback<Uri[]> callback) {
        if (imageCallback != null) imageCallback.onReceiveValue(null);
        imageCallback = callback;
        try {
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("image/*");
            startActivityForResult(intent, IMAGE_REQUEST);
        } catch (Exception e) {
            imageCallback = null;
            callback.onReceiveValue(null);
        }
        return true;
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != IMAGE_REQUEST || imageCallback == null) return;
        ValueCallback<Uri[]> callback = imageCallback;
        imageCallback = null;
        Uri uri = resultCode == RESULT_OK && data != null ? data.getData() : null;
        callback.onReceiveValue(uri == null ? null : new Uri[] { uri });
    }

    @Override
    protected void onDestroy() {
        if (imageCallback != null) { imageCallback.onReceiveValue(null); imageCallback = null; }
        if (web != null) {
            web.destroy();
        }
        super.onDestroy();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemUi();
        }
    }

    @Override
    public void onBackPressed() {
        if (web == null) {
            super.onBackPressed();
            return;
        }
        web.evaluateJavascript("(window.qalamBack?window.qalamBack():1)",
                new BackCb(this));
    }
}
