package com.qalam.studio;

import android.app.Activity;
import android.webkit.ValueCallback;

/** Reference Java mirror of android/smali/com/qalam/studio/BackCb.smali */
public class BackCb implements ValueCallback<String> {
    private final Activity act;

    public BackCb(Activity activity) {
        this.act = activity;
    }

    @Override
    public void onReceiveValue(String result) {
        if (result == null) {
            return;
        }
        if ("1".equals(result)) {   // JSON encoded number: exit the app
            act.finish();
        }
    }
}
