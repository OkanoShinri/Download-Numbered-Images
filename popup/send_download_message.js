var img_extentions = [""];
var ng_words = [""];
var download_folder = "";

//ポップアップメニューが開かれたとき、設定をストレージから読み取る
browser.storage.local
  .get()
  .then((restoredSettings) => {
    img_extentions = restoredSettings.img_extentions;
    ng_words = restoredSettings.ng_words;
    download_folder = restoredSettings.download_folder;
  })
  .catch((e) => {
    console.error("Failed :" + error.message);
  });

function listenForClicks() {
  document.addEventListener("click", (e) => {
    //content.jsにダウンロードコマンドを送る関数
    function notifyDownloadToContent(tabs) {
      let is_serialized = document.getElementById("serialize_check").checked;
      let rm_ngwords = document.getElementById("only_main_images").checked;
      if (tabs[0].status === "complete") {
        browser.tabs.sendMessage(tabs[0].id, {
          command: "download",
          is_serialized: is_serialized,
          img_extentions: img_extentions,
          rm_ngwords: rm_ngwords,
          ng_words: ng_words,
          download_folder: download_folder,
        });
      } else {
        //ページの読み込みが終わっていなかった場合、少し待って再度実行
        setTimeout(notifyDownloadToContent, 100);
      }
    }

    if (e.target.classList.contains("button")) {
      //ダウンロードボタンがクリックされたとき、content.jsにダウンロードコマンドを送る
      browser.tabs
        .query({ active: true, currentWindow: true })
        .then(notifyDownloadToContent)
        .catch((error) => {
          console.error("Could not download:" + error.message);
        });
    }
  });
}

//ポップアップメニューを開いたとき、アクティブタブにcontent.jsを実行させる
//さらにクリック時の関数をリッスンする
browser.tabs
  .executeScript({ file: "/content_scripts/content.js" })
  .then(listenForClicks)
  .catch((error) => {
    //開いているページでcontent.jsを実行できなかった場合、
    //ポップアップメニューのダウンロードボタンをエラーメッセージに変更する
    document.getElementById("download_button").classList.add("hidden");
    document.getElementById("error_content").classList.remove("hidden");
    console.error("Failed :" + error.message);
  });
