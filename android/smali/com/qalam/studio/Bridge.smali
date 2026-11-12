.class public Lcom/qalam/studio/Bridge;
.super Ljava/lang/Object;
.source "Bridge.java"


# instance fields
.field private act:Landroid/app/Activity;


# direct methods
.method public constructor <init>(Landroid/app/Activity;)V
    .locals 0

    invoke-direct {p0}, Ljava/lang/Object;-><init>()V

    iput-object p1, p0, Lcom/qalam/studio/Bridge;->act:Landroid/app/Activity;

    return-void
.end method


# virtual methods
.method public sdk()I
    .locals 1

    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation

    sget v0, Landroid/os/Build$VERSION;->SDK_INT:I

    return v0
.end method

.method public saveImage(Ljava/lang/String;Ljava/lang/String;Ljava/lang/String;)Z
    .locals 8

    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation

    const/4 v0, 0x0

    :try_start_0
    const/4 v1, 0x0

    invoke-static {p1, v1}, Landroid/util/Base64;->decode(Ljava/lang/String;I)[B

    move-result-object v2

    sget v3, Landroid/os/Build$VERSION;->SDK_INT:I

    const/16 v4, 0x1d

    if-lt v3, v4, :cond_legacy

    new-instance v4, Landroid/content/ContentValues;

    invoke-direct {v4}, Landroid/content/ContentValues;-><init>()V

    const-string v5, "_display_name"

    invoke-virtual {v4, v5, p3}, Landroid/content/ContentValues;->put(Ljava/lang/String;Ljava/lang/String;)V

    const-string v5, "mime_type"

    invoke-virtual {v4, v5, p2}, Landroid/content/ContentValues;->put(Ljava/lang/String;Ljava/lang/String;)V

    const-string v5, "relative_path"

    const-string v6, "video/"
    invoke-virtual {p2, v6}, Ljava/lang/String;->startsWith(Ljava/lang/String;)Z
    move-result v3
    if-eqz v3, :image_path
    const-string v6, "Movies/Qelem"
    goto :path_ready
    :image_path
    const-string v6, "Pictures/Qelem"
    :path_ready
    invoke-virtual {v4, v5, v6}, Landroid/content/ContentValues;->put(Ljava/lang/String;Ljava/lang/String;)V

    iget-object v5, p0, Lcom/qalam/studio/Bridge;->act:Landroid/app/Activity;

    invoke-virtual {v5}, Landroid/app/Activity;->getContentResolver()Landroid/content/ContentResolver;
    move-result-object v5

    if-eqz v3, :image_uri
    sget-object v6, Landroid/provider/MediaStore$Video$Media;->EXTERNAL_CONTENT_URI:Landroid/net/Uri;
    goto :uri_ready
    :image_uri
    sget-object v6, Landroid/provider/MediaStore$Images$Media;->EXTERNAL_CONTENT_URI:Landroid/net/Uri;
    :uri_ready
    invoke-virtual {v5, v6, v4}, Landroid/content/ContentResolver;->insert(Landroid/net/Uri;Landroid/content/ContentValues;)Landroid/net/Uri;
    move-result-object v6

    if-eqz v6, :cond_legacy

    invoke-virtual {v5, v6}, Landroid/content/ContentResolver;->openOutputStream(Landroid/net/Uri;)Ljava/io/OutputStream;
    move-result-object v7

    if-eqz v7, :cond_legacy

    invoke-virtual {v7, v2}, Ljava/io/OutputStream;->write([B)V

    invoke-virtual {v7}, Ljava/io/OutputStream;->close()V

    const/4 v0, 0x1

    goto :cond_end

    :cond_legacy
    iget-object v3, p0, Lcom/qalam/studio/Bridge;->act:Landroid/app/Activity;

    const/4 v4, 0x0

    invoke-virtual {v3, v4}, Landroid/app/Activity;->getExternalFilesDir(Ljava/lang/String;)Ljava/io/File;
    move-result-object v3

    if-eqz v3, :cond_end

    invoke-virtual {v3}, Ljava/io/File;->mkdirs()Z

    new-instance v4, Ljava/io/File;

    invoke-direct {v4, v3, p3}, Ljava/io/File;-><init>(Ljava/io/File;Ljava/lang/String;)V

    new-instance v5, Ljava/io/FileOutputStream;

    invoke-direct {v5, v4}, Ljava/io/FileOutputStream;-><init>(Ljava/io/File;)V

    invoke-virtual {v5, v2}, Ljava/io/FileOutputStream;->write([B)V

    invoke-virtual {v5}, Ljava/io/FileOutputStream;->close()V

    const/4 v0, 0x1

    :cond_end
    :try_end_0
    .catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :catch_0

    :cond_ret
    return v0

    :catch_0
    move-exception v1

    goto :cond_ret
.end method

.method public folder()Ljava/lang/String;
    .locals 3

    .annotation runtime Landroid/webkit/JavascriptInterface;
    .end annotation

    const-string v0, ""

    iget-object v1, p0, Lcom/qalam/studio/Bridge;->act:Landroid/app/Activity;

    const/4 v2, 0x0

    invoke-virtual {v1, v2}, Landroid/app/Activity;->getExternalFilesDir(Ljava/lang/String;)Ljava/io/File;
    move-result-object v1

    if-eqz v1, :cond_folder_end

    invoke-virtual {v1}, Ljava/io/File;->getAbsolutePath()Ljava/lang/String;
    move-result-object v0

    :cond_folder_end
    return-object v0
.end method
