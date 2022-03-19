browser.runtime.onMessage.addListener(catchMessage);

//storage.localの設定
let is_serialized = true;
let rm_ngwords = true;
let img_extentions = ["png", "jpeg", "jpg", "gif", "svg"];
let ng_words = ["profile", "hash", "240x240", "semantic_core_img"];
let download_folder = "DownloadNumberedImages/{title}";

//アドオンがインストールされたときに実行（初期化）
browser.runtime.onInstalled.addListener((details) => {
  browser.storage.local.set({
    is_serialized: is_serialized,
    rm_ngwords: rm_ngwords,
    img_extentions: img_extentions,
    ng_words: ng_words,
    download_folder: download_folder,
  });
});

//コンテキストメニューを作成
browser.menus.create({
  id: "download",
  title: "画像をダウンロード",
  contexts: ["all"],
});

//コンテキストメニューが表示されたとき
browser.menus.onShown.addListener((info) => {
  //設定をストレージから読み取る
  browser.storage.local
    .get()
    .then((restoredSettings) => {
      is_serialized = restoredSettings.is_serialized;
      rm_ngwords = restoredSettings.rm_ngwords;
      img_extentions = restoredSettings.img_extentions;
      ng_words = restoredSettings.ng_words;
      download_folder = restoredSettings.download_folder;
    })
    .catch((e) => {
      console.error(`Failed : ${e.message}`);
    });

  //開いているタブにcontent.jsを走らせる
  browser.tabs
    .executeScript({ file: "/content_scripts/content.js" })
    .then()
    .catch((e) => {
      console.error(`Failed : ${e.message}`);
    });
});

//コンテキストメニューがクリックされたとき
browser.menus.onClicked.addListener((info, tab) => {
  function notifyDownloadToContent(tab) {
    if (tab.status === "complete") {
      browser.tabs.sendMessage(tab.id, {
        command: "download",
        is_serialized: is_serialized,
        rm_ngwords: rm_ngwords,
        img_extentions: img_extentions,
        ng_words: ng_words,
        download_folder: download_folder,
      });
    } else {
      setTimeout(notifyDownloadToContent, 100);
    }
  }

  //content.jsのダウンロード関数を発火
  //note: このとき既に開いているタブにcontent.jsを実行させたはず
  switch (info.menuItemId) {
    case "download":
      notifyDownloadToContent(tab);
  }
});

//content.jsから送られてきたメッセージをキャッチ
function catchMessage(message) {
  if (!message.command) {
    return;
  }
  if (message.command == "download") {
    //ダウンロード実行
    let directory = message.folder + "/" + message.filename;
    browser.downloads.download({
      url: message.url,
      filename: directory,
    });
    console.log("download " + directory + " from " + message.url);
  } else if (message.command == "no_img_notice") {
    let message =
      "このページにはダウンロードできる画像がありませんでした\n\nオプション内の除外ワードも確認してください";
    createNotification(message);
  }
}

//通知を生成
function createNotification(message) {
  browser.notifications.create({
    type: "basic",
    title: "EasyImgDownloader",
    message: message,
  });
}
