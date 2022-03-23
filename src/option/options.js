//Hint: popup.jsとoption.jsはやることがほぼ一緒

//オプションページが開かれたとき、設定をストレージから読み取る
browser.storage.local
  .get()
  .then((restoredSettings) => {
    document.getElementById("serialize_check").checked =
      restoredSettings.is_serialized;
    document.getElementById("rm_ngwords").checked = restoredSettings.rm_ngwords;
    document.getElementById("ng_words").value =
      restoredSettings.ng_words.join("\n");
    document.getElementById("download_folder").value =
      restoredSettings.download_folder;
    document.getElementById("download_all").checked =
      restoredSettings.download_all;
    document.getElementById("timeout").value = restoredSettings.timeout;
  })
  .catch((e) => {
    console.error(`Failed : ${e.message}`);
  });

// オプションページで設定を変更したとき、それをストレージに保存する
document
  .getElementById("serialize_check")
  .addEventListener("change", storeSettings);
document.getElementById("rm_ngwords").addEventListener("change", storeSettings);
document.getElementById("ng_words").addEventListener("change", storeSettings);
document
  .getElementById("download_folder")
  .addEventListener("change", storeSettings);
document
  .getElementById("download_all")
  .addEventListener("change", storeSettings);
document.getElementById("timeout").addEventListener("change", storeSettings);

// option.htmlの内容をストレージにセットする
function storeSettings() {
  let is_serialized = document.getElementById("serialize_check").checked;
  let rm_ngwords = document.getElementById("rm_ngwords").checked;
  let ng_words_ = document.getElementById("ng_words").value.split("\n");
  let ng_words = [];
  for (var i = 0; i < ng_words_.length; ++i) {
    if (ng_words_[i] !== "") ng_words.push(ng_words_[i]);
  }
  let download_folder = document.getElementById("download_folder").value;
  let download_all = document.getElementById("download_all").checked;
  let timeout = document.getElementById("timeout").value;
  if (Number(timeout) < 1) {
    timeout = 1;
  }
  browser.storage.local.set({
    is_serialized: is_serialized,
    rm_ngwords: rm_ngwords,
    ng_words: ng_words,
    download_folder: download_folder,
    download_all: download_all,
    timeout: timeout,
  });
}
