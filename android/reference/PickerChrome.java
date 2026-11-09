package com.qalam.studio;

import android.net.Uri;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;

/** Opens the Android document picker for Qalam's image input. */
public class PickerChrome extends WebChromeClient {
    private final MainActivity activity;
    public PickerChrome(MainActivity activity) { this.activity = activity; }
    @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
        return activity.chooseImage(callback);
    }
}
