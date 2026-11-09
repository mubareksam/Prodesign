package com.qalam.studio;

import android.net.Uri;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;

/** Opens the Android document picker for Qalam's image and audio inputs. */
public class PickerChrome extends WebChromeClient {
    private final MainActivity activity;
    public PickerChrome(MainActivity activity) { this.activity = activity; }
    @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
        String type = "image/*";
        if (params != null) {
            String[] accepts = params.getAcceptTypes();
            if (accepts != null) for (String accept : accepts) {
                if (accept != null && accept.startsWith("audio/")) { type = "audio/*"; break; }
            }
        }
        return activity.chooseFile(callback, type);
    }
}
