browser.runtime.onInstalled.addListener(initialize);
browser.runtime.onMessage.addListener(catchMessage);

//コンテキストメニューが表示されたとき
browser.menus.onShown.addListener((info) => {
  let is_single_download_mode = false;
  if (info.linkUrl || info.srcUrl) {
    is_single_download_mode = true;
  }
  //開いているタブにcontent.jsを走らせる
  browser.tabs
    .executeScript({ file: "/src/content_scripts/content.js" })
    .then(() => {
      browser.menus.update("download", {
        visible: !is_single_download_mode,
      });
      browser.menus.update("single_download", {
        visible: is_single_download_mode,
      });
      browser.menus.refresh();
    })
    .catch((e) => {
      browser.menus.update("download", {
        visible: false,
      });
      browser.menus.update("single_download", {
        visible: false,
      });
      browser.menus.refresh();
      console.error(`Failed : ${e.message}`);
    });
});

//コンテキストメニューがクリックされたとき
browser.menus.onClicked.addListener((info, tab) => {
  //content.jsのダウンロード関数を発火
  //note: このとき既に開いているタブにcontent.jsを実行させたはず
  switch (info.menuItemId) {
    case "download": {
      const timeout = setTimeout(() => {
        createNotification("ページの読み込みに時間がかかっています・・・\n()");
      }, 2000);
      browser.tabs
        .executeScript({ file: "/src/content_scripts/content.js" })
        .then(() => {
          window.clearTimeout(timeout);
          notifyDownloadToContent(tab);
        })
        .catch((e) => {
          console.error(`Failed : ${e.message}`);
        });

      break;
    }
    case "single_download": {
      browser.tabs.sendMessage(tab.id, {
        command: "send_single_download_data",
        link_url: info.linkUrl,
        src_url: info.srcUrl,
      });

      break;
    }
  }
});

//コンテキストメニューを作成
browser.menus.create({
  id: "download",
  title: "画像を一括ダウンロード",
  contexts: ["all"],
});
browser.menus.create({
  id: "single_download",
  title: "この画像をダウンロード",
  contexts: ["image"],
});

//アドオンがインストールされたときに実行（初期化）
function initialize() {
  //storage.localの設定
  let is_serialized = true;
  let rm_ngwords = true;
  let ng_words = [
    ".gif",
    "profile",
    "icon",
    "logo",
    "stamp",
    "filter",
    "banner",
    "/\\D\\d{3}x\\d{3}/",
  ];
  let download_folder = "DownloadNumberedImages/{title}";
  let download_all = false;
  let timeout = 15;
  browser.storage.local
    .set({
      is_serialized: is_serialized,
      rm_ngwords: rm_ngwords,
      ng_words: ng_words,
      download_folder: download_folder,
      download_all: download_all,
      timeout: timeout,
    })
    .catch((e) => {
      console.error(`Failed : ${e.message}`);
    });
  setTimeout(browser.runtime.openOptionsPage, 500);
}

//送られてきたメッセージをキャッチ
function catchMessage(message) {
  if (!message.command) {
    return;
  }

  switch (message.command) {
    case "popup_clicked": {
      const timeout = setTimeout(() => {
        createNotification(
          "ページの読み込みに時間がかかっています\nリロードしないでください・・・"
        );
      }, 2000);
      browser.tabs
        .executeScript({ file: "/src/content_scripts/content.js" })
        .then(() => {
          browser.tabs
            .query({ active: true, currentWindow: true })
            .then((tabs) => {
              notifyDownloadToContent(tabs[0]);
              window.clearTimeout(timeout);
            })
            .catch((error) => {
              console.error("Could not download:" + error.message);
            });
        })
        .catch((e) => {
          console.error(`Failed : ${e.message}`);
        });

      break;
    }
    case "download": {
      //ダウンロード実行
      if (message.url.includes("data:image/")) {
        // 参考サイト
        // https://lab.syncer.jp/Web/JavaScript/Snippet/26/
        let byte_string = window.atob(message.url.split(",")[1]);
        let content_type = message.url
          .match(/data:image\/.+?;/g)[0]
          .slice(11)
          .slice(0, -1);

        let decoded = new Uint8Array(byte_string.length);
        for (let i = 0; i < byte_string.length; i++) {
          decoded[i] = byte_string.charCodeAt(i);
        }
        let blob = new Blob([decoded], { type: content_type });

        let url = URL.createObjectURL(blob);
        browser.downloads.download({
          url: url,
          filename: message.filename,
        });
      } else {
        browser.downloads.download({
          url: message.url,
          filename: message.filename,
        });
      }
      console.log("download " + message.filename + " from " + message.url);
      break;
    }
    case "notice": {
      createNotification(message.text);
      break;
    }
    case "select_start": {
      browser.menus.update("download", {
        title: "選択範囲の画像をダウンロード",
      });
      browser.menus.refresh();
      break;
    }
    case "select_remove": {
      browser.menus.update("download", {
        title: "画像を一括ダウンロード",
      });
      browser.menus.refresh();
      break;
    }
    default:
      break;
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

//ダウンロードをcontent.jsに通知
function notifyDownloadToContent(tab) {
  if (tab.status === "complete") {
    browser.tabs.sendMessage(tab.id, {
      command: "send_download_data",
    });
  } else {
    setTimeout(() => {
      notifyDownloadToContent(tab);
    }, 100);
  }
}
