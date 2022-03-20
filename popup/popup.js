//Hint: popup.jsとoption.jsはやることがほぼ一緒

//popup.htmlの内容をストレージにセットする
function storeSettings() {
  let is_serialized = document.getElementById("serialize_check").checked;
  let rm_ngwords = document.getElementById("only_main_images").checked;
  browser.storage.local.set({
    is_serialized: is_serialized,
    rm_ngwords: rm_ngwords,
  });
}

//ポップアップメニューが開かれたとき、設定をストレージから読み取る
browser.storage.local
  .get()
  .then((restoredSettings) => {
    document.getElementById("serialize_check").checked =
      restoredSettings.is_serialized;
    document.getElementById("only_main_images").checked =
      restoredSettings.rm_ngwords;
  })
  .catch((e) => {
    console.error(`Failed : ${e.message}`);
  });

// ポップアップページで設定を変更したとき、それをストレージに保存する
document
  .getElementById("serialize_check")
  .addEventListener("change", storeSettings);
document
  .getElementById("only_main_images")
  .addEventListener("change", storeSettings);
document.getElementById("option_button").addEventListener("click", (e) => {
  browser.runtime.openOptionsPage();
});
