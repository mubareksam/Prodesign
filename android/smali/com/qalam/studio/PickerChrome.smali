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
    .locals 5
    const-string v0, "image/*"
    if-eqz p3, :choose
    invoke-virtual {p3}, Landroid/webkit/WebChromeClient$FileChooserParams;->getAcceptTypes()[Ljava/lang/String;
    move-result-object v1
    if-eqz v1, :choose
    array-length v2, v1
    const/4 v3, 0x0
    :loop
    if-ge v3, v2, :choose
    aget-object v4, v1, v3
    if-eqz v4, :next
    const-string p1, "audio/"
    invoke-virtual {v4, p1}, Ljava/lang/String;->startsWith(Ljava/lang/String;)Z
    move-result v4
    if-eqz v4, :next
    const-string v0, "audio/*"
    goto :choose
    :next
    add-int/lit8 v3, v3, 0x1
    goto :loop
    :choose
    iget-object v1, p0, Lcom/qalam/studio/PickerChrome;->activity:Lcom/qalam/studio/MainActivity;
    invoke-virtual {v1, p2, v0}, Lcom/qalam/studio/MainActivity;->chooseFile(Landroid/webkit/ValueCallback;Ljava/lang/String;)Z
    move-result v0
    return v0
.end method
