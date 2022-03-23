function listenForClicks() {
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("button")) {
      //ダウンロードボタンがクリックされたとき、内容を保存してからbackgroundにダウンロードコマンドを送る
      let is_serialized = document.getElementById("serialize_check").checked;
      let rm_ngwords = document.getElementById("rm_ngwords").checked;
      browser.storage.local
        .set({
          is_serialized: is_serialized,
          rm_ngwords: rm_ngwords,
        })
        .then(() => {
          browser.runtime.sendMessage({
            command: "popup_clicked",
          });
        })
        .catch((e) => {
          console.error(`Failed :${e.message}`);
        });
    }
  });
}

//ポップアップメニューを開いたとき、アクティブタブにcontent.jsを実行させる
//さらにクリック時の関数をリッスンする
browser.tabs
  .executeScript({ file: "/src/content_scripts/content.js" })
  .then(listenForClicks)
  .catch((error) => {
    //開いているページでcontent.jsを実行できなかった場合、
    //ポップアップメニューのダウンロードボタンをエラーメッセージに変更する
    document.getElementById("download_button").classList.add("hidden");
    document.getElementById("error_content").classList.remove("hidden");
    console.error("Failed :" + error.message);
  });
