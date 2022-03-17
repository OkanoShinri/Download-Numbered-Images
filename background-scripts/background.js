browser.runtime.onMessage.addListener(catchMessage);

//storage.localの設定
let ng_words = ["profile", "hash", "240x240", "semantic_core_img", "thumb"];
browser.runtime.onInstalled.addListener((details) => {
  browser.storage.local.set({
    is_serialized: true,
    is_only_main_images: true,
    ng_words: ng_words,
    download_folder: "EasyImgDownloader/{title}",
  });
});

browser.storage.onChanged.addListener((changeData) => {
  ng_words = changeData.ng_words.newValue;
});

function catchMessage(message) {
  if (!message.command) {
    return;
  }
  if (message.command == "download") {
    browser.downloads.download({
      url: message.url,
      filename: message.folder + "/" + message.filename,
    });
    console.log("download " + message.url);
  } else if (message.command == "no_img_notice") {
    browser.notifications.create({
      type: "basic",
      title: "EasyImgDownloader",
      message:
        "このページにはダウンロードできる画像がありませんでした\n\nオプション内の除外ワードも確認してください",
    });
  }
}
