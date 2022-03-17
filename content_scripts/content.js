var ng_words = [];
var download_folder;

browser.storage.local.get(["ng_words"]).then((result) => {
  ng_words = result.ng_words;
});
browser.storage.local.get(["download_folder"]).then((result) => {
  download_folder = result.download_folder;
});

(function () {
  //グローバルなガード変数をチェック、設定する
  if (window.hasRun) {
    return;
  }
  window.hasRun = true;

  function relUrlToAbsUrl(url) {
    if (!url.includes("http")) {
      var temp = document.createElement("a");
      temp.href = url;
      return temp.href;
    } else {
      return url;
    }
  }

  function getOrigUrlForTwitter(url) {
    let result = url;
    if (url.includes("name=")) {
      let querys = url.split("?").slice(-1)[0].split("&");
      for (let i = 0; i < querys.length; i++) {
        if (querys[i].includes("name=")) {
          let size = querys[i].split("=").slice(-1)[0];
          result = result.replace(size, "orig");
        }
      }
    }
    return result;
  }

  function notifyDownloadToBackground(url, filename) {
    //background-scriptに送信
    let title = document.title.replace(/http.*/g, "");
    let download_folder_ = download_folder.replace("{title}", title);
    download_folder_ = removeSymbols(download_folder_);
    browser.runtime.sendMessage({
      command: "download",
      url: url,
      filename: filename,
      folder: download_folder_,
    });
  }

  function removeSymbols(url) {
    let marks = [" ", "\\", ":", "*", "?", "<", ">", "|"];
    for (var i = 0; i < marks.length; i++) {
      url = url.split(marks[i]).join("_");
    }
    return url;
  }

  function isImage(url) {
    if (
      url.includes("png") ||
      url.includes("jpeg") ||
      url.includes("jpg") ||
      url.includes("gif")
    ) {
      return true;
    } else {
      return false;
    }
  }

  function notMainContents(url) {
    for (let i = 0; i < ng_words.length; i++) {
      if (url.includes(ng_words[i])) {
        console.log(url + " was removed because it includes " + ng_words[i]);
        return true;
      }
    }
    return false;
  }

  function getExtension(text) {
    let splited = text.split("/");
    let file_name = splited.slice(-1)[0];
    let entention = file_name.split(".");
    if (entention.length === 1) {
      //twitter等
      let querys = file_name.split("?").slice(-1)[0];
      let format = "";
      if (querys.length > 0 && querys.split("&").length > 0) {
        keys = querys.split("&");
        for (let i = 0; i < keys.length; i++) {
          if (keys[i].includes("format")) {
            format = keys[i].split("=").slice(-1)[0];
          }
        }
      }
      return format;
    } else {
      return entention.slice(-1)[0];
    }
  }

  function downloadImageFromTag(message, tag, init_index) {
    let index = init_index;
    let attribute = "href";
    if (tag == "img") {
      attribute = "src";
    }

    const imgs = document.getElementsByTagName(tag);
    let img_srcs = new Array();

    for (var i = 0; i < imgs.length; i++) {
      let src_ = imgs[i].getAttribute(attribute);
      if (src_ === null) {
        continue;
      }

      let ref = relUrlToAbsUrl(src_);
      if (!isImage(ref)) {
        continue;
      }
      if (message.is_only_main_images && notMainContents(ref)) {
        continue;
      }

      if (ref.includes("twi")) {
        ref = getOrigUrlForTwitter(ref);
      }

      let file_name = "";
      if (message.is_serialized) {
        file_name = String(index) + "." + getExtension(ref);
      } else {
        let splited = ref.split("/");
        file_name = splited.slice(-1)[0];
        if (!file_name.includes(".")) {
          file_name = file_name + "." + getExtension(ref);
        }
      }
      notifyDownloadToBackground(ref, file_name);
      img_srcs.push(ref);
      index++;
    }
    if (img_srcs.length === 0) {
      console.log('"' + tag + '" タグでは見つかりませんでした');
    }
    return index;
  }

  browser.runtime.onMessage.addListener((message) => {
    if (
      message.command != "download" ||
      message.is_serialized == null ||
      message.is_only_main_images == null
    ) {
      return;
    }

    let index = 0;
    console.log("開始");
    //<a>を検索
    index = downloadImageFromTag(message, "a", index);
    //<img>を検索
    index = downloadImageFromTag(message, "img", index);
    if (index === 0) {
      browser.runtime.sendMessage({
        command: "no_img_notice",
      });
      console.log("画像がなかったよ");
    }
    console.log("終了");
  });
})();
