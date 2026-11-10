.class public Lcom/qalam/studio/BackCb;
.super Ljava/lang/Object;
.source "BackCb.java"

# interfaces
.implements Landroid/webkit/ValueCallback;


# instance fields
.field private act:Landroid/app/Activity;


# direct methods
.method public constructor <init>(Landroid/app/Activity;)V
    .locals 0

    invoke-direct {p0}, Ljava/lang/Object;-><init>()V

    iput-object p1, p0, Lcom/qalam/studio/BackCb;->act:Landroid/app/Activity;

    return-void
.end method


# virtual methods
.method public onReceiveValue(Ljava/lang/Object;)V
    .locals 2

    if-eqz p1, :cond_back_end

    check-cast p1, Ljava/lang/String;

    const-string v0, "1"

    invoke-virtual {v0, p1}, Ljava/lang/String;->equals(Ljava/lang/Object;)Z

    move-result v0

    if-eqz v0, :cond_back_end

    iget-object v1, p0, Lcom/qalam/studio/BackCb;->act:Landroid/app/Activity;

    invoke-virtual {v1}, Landroid/app/Activity;->finish()V

    :cond_back_end
    return-void
.end method
