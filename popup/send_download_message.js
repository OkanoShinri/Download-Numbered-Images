function listenForClicks() {
  document.addEventListener("click", (e) => {
    //content.jsにダウンロードコマンドを送る関数
    function notifyDownloadToContent(tabs) {
      let is_serialized = document.getElementById("serialize_check").checked;
      let is_only_main_images =
        document.getElementById("only_main_images").checked;
      if (tabs[0].status === "complete") {
        browser.tabs.sendMessage(tabs[0].id, {
          command: "download",
          is_serialized: is_serialized,
          is_only_main_images: is_only_main_images,
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
          console.error("Could not download: ${error}");
        });
    }
    if (e.target.classList.contains("option")) {
      //オプションボタンがクリックされたとき、オプションメニューを開く
      browser.runtime.openOptionsPage();
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
    document.getElementById("download-button").classList.add("hidden");
    document.getElementById("error-content").classList.remove("hidden");
    console.error("Failed : ${error.message}");
  });
