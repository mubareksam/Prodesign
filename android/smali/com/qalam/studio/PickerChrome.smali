.class public Lcom/qalam/studio/PickerChrome;
.super Landroid/webkit/WebChromeClient;
.source "PickerChrome.java"

.field private activity:Lcom/qalam/studio/MainActivity;

.method public constructor <init>(Lcom/qalam/studio/MainActivity;)V
    .locals 0
    invoke-direct {p0}, Landroid/webkit/WebChromeClient;-><init>()V
    iput-object p1, p0, Lcom/qalam/studio/PickerChrome;->activity:Lcom/qalam/studio/MainActivity;
    return-void
.end method

.method public onShowFileChooser(Landroid/webkit/WebView;Landroid/webkit/ValueCallback;Landroid/webkit/WebChromeClient$FileChooserParams;)Z
    .locals 1
    iget-object v0, p0, Lcom/qalam/studio/PickerChrome;->activity:Lcom/qalam/studio/MainActivity;
    invoke-virtual {v0, p2}, Lcom/qalam/studio/MainActivity;->chooseImage(Landroid/webkit/ValueCallback;)Z
    move-result v0
    return v0
.end method
