.class public Lcom/qalam/studio/MainActivity;
.super Landroid/app/Activity;
.source "MainActivity.java"


# instance fields
.field private bridge:Lcom/qalam/studio/Bridge;

.field private web:Landroid/webkit/WebView;


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

.method protected onDestroy()V
    .locals 1

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
