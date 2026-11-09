.class public Lcom/qalam/studio/MainActivity;
.super Landroid/app/Activity;
.source "MainActivity.java"


# instance fields
.field private bridge:Lcom/qalam/studio/Bridge;

.field private web:Landroid/webkit/WebView;

.field private imageCallback:Landroid/webkit/ValueCallback;


# direct methods
.method public constructor <init>()V
    .locals 0

    invoke-direct {p0}, Landroid/app/Activity;-><init>()V

    return-void
.end method

.method private hideSystemUi()V
    .locals 2

    invoke-virtual {p0}, Lcom/qalam/studio/MainActivity;->getWindow()Landroid/view/Window;
    move-result-object v0

    invoke-virtual {v0}, Landroid/view/Window;->getDecorView()Landroid/view/View;
    move-result-object v0

    const/16 v1, 0x101f

    invoke-virtual {v0, v1}, Landroid/view/View;->setSystemUiVisibility(I)V

    return-void
.end method


# virtual methods
.method protected onCreate(Landroid/os/Bundle;)V
    .locals 6

    invoke-super {p0, p1}, Landroid/app/Activity;->onCreate(Landroid/os/Bundle;)V

    invoke-direct {p0}, Lcom/qalam/studio/MainActivity;->hideSystemUi()V

    invoke-virtual {p0}, Lcom/qalam/studio/MainActivity;->getWindow()Landroid/view/Window;
    move-result-object v0

    const/16 v1, 0x80

    invoke-virtual {v0, v1}, Landroid/view/Window;->addFlags(I)V

    new-instance v0, Lcom/qalam/studio/Bridge;

    invoke-direct {v0, p0}, Lcom/qalam/studio/Bridge;-><init>(Landroid/app/Activity;)V

    iput-object v0, p0, Lcom/qalam/studio/MainActivity;->bridge:Lcom/qalam/studio/Bridge;

    new-instance v1, Landroid/webkit/WebView;

    invoke-direct {v1, p0}, Landroid/webkit/WebView;-><init>(Landroid/content/Context;)V

    iput-object v1, p0, Lcom/qalam/studio/MainActivity;->web:Landroid/webkit/WebView;

    const v2, 0xff101014

    invoke-virtual {v1, v2}, Landroid/webkit/WebView;->setBackgroundColor(I)V

    invoke-virtual {v1}, Landroid/webkit/WebView;->getSettings()Landroid/webkit/WebSettings;
    move-result-object v2

    const/4 v3, 0x1

    invoke-virtual {v2, v3}, Landroid/webkit/WebSettings;->setJavaScriptEnabled(Z)V

    invoke-virtual {v2, v3}, Landroid/webkit/WebSettings;->setDomStorageEnabled(Z)V

    invoke-virtual {v2, v3}, Landroid/webkit/WebSettings;->setAllowFileAccess(Z)V

    invoke-virtual {v2, v3}, Landroid/webkit/WebSettings;->setAllowFileAccessFromFileURLs(Z)V

    invoke-virtual {v2, v3}, Landroid/webkit/WebSettings;->setAllowUniversalAccessFromFileURLs(Z)V

    invoke-virtual {v2, v3}, Landroid/webkit/WebSettings;->setUseWideViewPort(Z)V

    invoke-virtual {v2, v3}, Landroid/webkit/WebSettings;->setLoadWithOverviewMode(Z)V

    invoke-virtual {v2, v3}, Landroid/webkit/WebSettings;->setJavaScriptCanOpenWindowsAutomatically(Z)V

    const/4 v4, 0x0

    invoke-virtual {v2, v4}, Landroid/webkit/WebSettings;->setBuiltInZoomControls(Z)V

    invoke-virtual {v2, v4}, Landroid/webkit/WebSettings;->setDisplayZoomControls(Z)V

    invoke-virtual {v2, v4}, Landroid/webkit/WebSettings;->setSupportMultipleWindows(Z)V

    invoke-virtual {v2, v4}, Landroid/webkit/WebSettings;->setMediaPlaybackRequiresUserGesture(Z)V

    const/16 v4, 0x64

    invoke-virtual {v2, v4}, Landroid/webkit/WebSettings;->setTextZoom(I)V

    iget-object v4, p0, Lcom/qalam/studio/MainActivity;->bridge:Lcom/qalam/studio/Bridge;

    const-string v5, "QalamNative"

    invoke-virtual {v1, v4, v5}, Landroid/webkit/WebView;->addJavascriptInterface(Ljava/lang/Object;Ljava/lang/String;)V

    new-instance v4, Landroid/webkit/WebViewClient;

    invoke-direct {v4}, Landroid/webkit/WebViewClient;-><init>()V

    invoke-virtual {v1, v4}, Landroid/webkit/WebView;->setWebViewClient(Landroid/webkit/WebViewClient;)V

    new-instance v4, Lcom/qalam/studio/PickerChrome;
    invoke-direct {v4, p0}, Lcom/qalam/studio/PickerChrome;-><init>(Lcom/qalam/studio/MainActivity;)V
    invoke-virtual {v1, v4}, Landroid/webkit/WebView;->setWebChromeClient(Landroid/webkit/WebChromeClient;)V

    const/4 v4, 0x2

    invoke-virtual {v1, v4}, Landroid/webkit/WebView;->setOverScrollMode(I)V

    invoke-virtual {v1, v3}, Landroid/webkit/WebView;->setHapticFeedbackEnabled(Z)V

    const-string v4, "file:///android_asset/app/index.html"

    invoke-virtual {v1, v4}, Landroid/webkit/WebView;->loadUrl(Ljava/lang/String;)V

    invoke-virtual {p0, v1}, Landroid/app/Activity;->setContentView(Landroid/view/View;)V

    return-void
.end method

.method protected onResume()V
    .locals 1

    invoke-super {p0}, Landroid/app/Activity;->onResume()V

    iget-object v0, p0, Lcom/qalam/studio/MainActivity;->web:Landroid/webkit/WebView;

    if-eqz v0, :cond_resume_end

    invoke-virtual {v0}, Landroid/webkit/WebView;->onResume()V

    :cond_resume_end
    invoke-direct {p0}, Lcom/qalam/studio/MainActivity;->hideSystemUi()V

    return-void
.end method

.method protected onPause()V
    .locals 1

    invoke-super {p0}, Landroid/app/Activity;->onPause()V

    iget-object v0, p0, Lcom/qalam/studio/MainActivity;->web:Landroid/webkit/WebView;

    if-eqz v0, :cond_pause_end

    invoke-virtual {v0}, Landroid/webkit/WebView;->onPause()V

    :cond_pause_end
    return-void
.end method

.method public chooseFile(Landroid/webkit/ValueCallback;Ljava/lang/String;)Z
    .locals 3
    iget-object v0, p0, Lcom/qalam/studio/MainActivity;->imageCallback:Landroid/webkit/ValueCallback;
    if-eqz v0, :no_old_callback
    const/4 v1, 0x0
    invoke-interface {v0, v1}, Landroid/webkit/ValueCallback;->onReceiveValue(Ljava/lang/Object;)V
    :no_old_callback
    iput-object p1, p0, Lcom/qalam/studio/MainActivity;->imageCallback:Landroid/webkit/ValueCallback;
    :try_start_picker
    new-instance v0, Landroid/content/Intent;
    const-string v1, "android.intent.action.OPEN_DOCUMENT"
    invoke-direct {v0, v1}, Landroid/content/Intent;-><init>(Ljava/lang/String;)V
    const-string v1, "android.intent.category.OPENABLE"
    invoke-virtual {v0, v1}, Landroid/content/Intent;->addCategory(Ljava/lang/String;)Landroid/content/Intent;
    invoke-virtual {v0, p2}, Landroid/content/Intent;->setType(Ljava/lang/String;)Landroid/content/Intent;
    const/16 v1, 0x1069
    invoke-virtual {p0, v0, v1}, Lcom/qalam/studio/MainActivity;->startActivityForResult(Landroid/content/Intent;I)V
    :try_end_picker
    .catch Ljava/lang/Exception; {:try_start_picker .. :try_end_picker} :picker_failed
    goto :picker_done
    :picker_failed
    move-exception v0
    const/4 v1, 0x0
    iput-object v1, p0, Lcom/qalam/studio/MainActivity;->imageCallback:Landroid/webkit/ValueCallback;
    invoke-interface {p1, v1}, Landroid/webkit/ValueCallback;->onReceiveValue(Ljava/lang/Object;)V
    :picker_done
    const/4 v0, 0x1
    return v0
.end method

.method protected onActivityResult(IILandroid/content/Intent;)V
    .locals 4
    invoke-super {p0, p1, p2, p3}, Landroid/app/Activity;->onActivityResult(IILandroid/content/Intent;)V
    const/16 v0, 0x1069
    if-ne p1, v0, :result_done
    iget-object v0, p0, Lcom/qalam/studio/MainActivity;->imageCallback:Landroid/webkit/ValueCallback;
    if-eqz v0, :result_done
    const/4 v1, 0x0
    iput-object v1, p0, Lcom/qalam/studio/MainActivity;->imageCallback:Landroid/webkit/ValueCallback;
    const/4 v2, -0x1
    if-ne p2, v2, :result_deliver
    if-eqz p3, :result_deliver
    invoke-virtual {p3}, Landroid/content/Intent;->getData()Landroid/net/Uri;
    move-result-object v2
    if-eqz v2, :result_deliver
    const/4 v3, 0x1
    new-array v1, v3, [Landroid/net/Uri;
    const/4 v3, 0x0
    aput-object v2, v1, v3
    :result_deliver
    invoke-interface {v0, v1}, Landroid/webkit/ValueCallback;->onReceiveValue(Ljava/lang/Object;)V
    :result_done
    return-void
.end method

.method protected onDestroy()V
    .locals 2

    iget-object v0, p0, Lcom/qalam/studio/MainActivity;->imageCallback:Landroid/webkit/ValueCallback;
    if-eqz v0, :no_destroy_callback
    const/4 v1, 0x0
    iput-object v1, p0, Lcom/qalam/studio/MainActivity;->imageCallback:Landroid/webkit/ValueCallback;
    invoke-interface {v0, v1}, Landroid/webkit/ValueCallback;->onReceiveValue(Ljava/lang/Object;)V
    :no_destroy_callback
    iget-object v0, p0, Lcom/qalam/studio/MainActivity;->web:Landroid/webkit/WebView;

    if-eqz v0, :cond_destroy_end

    invoke-virtual {v0}, Landroid/webkit/WebView;->destroy()V

    :cond_destroy_end
    invoke-super {p0}, Landroid/app/Activity;->onDestroy()V

    return-void
.end method

.method public onWindowFocusChanged(Z)V
    .locals 0

    invoke-super {p0, p1}, Landroid/app/Activity;->onWindowFocusChanged(Z)V

    if-eqz p1, :cond_focus_end

    invoke-direct {p0}, Lcom/qalam/studio/MainActivity;->hideSystemUi()V

    :cond_focus_end
    return-void
.end method

.method public onBackPressed()V
    .locals 3

    iget-object v0, p0, Lcom/qalam/studio/MainActivity;->web:Landroid/webkit/WebView;

    if-nez v0, :cond_back_web

    invoke-super {p0}, Landroid/app/Activity;->onBackPressed()V

    return-void

    :cond_back_web
    new-instance v1, Lcom/qalam/studio/BackCb;

    invoke-direct {v1, p0}, Lcom/qalam/studio/BackCb;-><init>(Landroid/app/Activity;)V

    const-string v2, "(window.qalamBack?window.qalamBack():1)"

    invoke-virtual {v0, v2, v1}, Landroid/webkit/WebView;->evaluateJavascript(Ljava/lang/String;Landroid/webkit/ValueCallback;)V

    return-void
.end method
