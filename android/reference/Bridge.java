// Reference Java mirror of android/smali/com/qalam/studio/Bridge.smali and
// BackCb.smali. Compiled during the build to type-check the API usage in the
// hand-written smali; never packaged into the APK.
package com.qalam.studio;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class Bridge {
    private final Activity act;

    public Bridge(Activity activity) {
        this.act = activity;
    }

    @JavascriptInterface
    public int sdk() {
        return Build.VERSION.SDK_INT;
    }

    /** Writes the base64 payload to the user's gallery (API 29+) or app folder. */
    @JavascriptInterface
    public boolean saveImage(String base64, String mime, String name) {
        boolean ok = false;
        try {
            byte[] bytes = Base64.decode(base64, 0);
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues cv = new ContentValues();
                cv.put("_display_name", name);
                cv.put("mime_type", mime);
                boolean video = mime != null && mime.startsWith("video/");
                cv.put("relative_path", video ? "Movies/Qelem" : "Pictures/Qelem");
                ContentResolver cr = act.getContentResolver();
                Uri uri = cr.insert(video ? MediaStore.Video.Media.EXTERNAL_CONTENT_URI : MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv);
                if (uri != null) {
                    OutputStream out = cr.openOutputStream(uri);
                    if (out != null) {
                        out.write(bytes);
                        out.close();
                        ok = true;
                        return ok;
                    }
                }
            }
            File dir = act.getExternalFilesDir(null);
            if (dir != null) {
                dir.mkdirs();
                File target = new File(dir, name);
                FileOutputStream fos = new FileOutputStream(target);
                fos.write(bytes);
                fos.close();
                ok = true;
            }
        } catch (Exception e) {
            return ok;
        }
        return ok;
    }

    @JavascriptInterface
    public String folder() {
        String path = "";
        File dir = act.getExternalFilesDir(null);
        if (dir != null) {
            path = dir.getAbsolutePath();
        }
        return path;
    }
}
