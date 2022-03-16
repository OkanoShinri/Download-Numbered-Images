(function () {
  //グローバルなガード変数をチェック、設定する。
  if (window.hasRun) {
    return;
  }
  window.hasRun = true;

  function RelUrlToAbsUrl(url) {
    if (!url.match(/http/)) {
      var temp = document.createElement("a");
      temp.href = url;
      return temp.href;
    } else {
      return url;
    }
  }

  function notifyDownloadToBackground(url, filename) {
    //background-scriptに送信
    browser.runtime.sendMessage({
      url: url,
      filename: filename,
      title: document.title,
    });
  }

  function isImage(url) {
    if (url.includes("png") || url.includes("jpeg") || url.includes("jpg")) {
      return true;
    } else {
      return false;
    }
  }

  function getExtension(text) {
    if (text.includes("png")) {
      return "png";
    } else if (text.includes("jpeg")) {
      return "jpeg";
    } else if (text.includes("jpg")) {
      return "jpg";
    } else {
      return "";
    }
  }

  browser.runtime.onMessage.addListener((message) => {
    if (message.command === "download") {
      console.log("ダウンロードコマンドがタブに到達しました。");
      //downloadImg();
    }

    let index = 0;

    //<a>を検索
    const srcs = document.getElementsByTagName("a");
    let img_refs = new Array();

    console.log("開始");
    for (var i = 0; i < srcs.length; i++) {
      let href_ = srcs[i].getAttribute("href");
      if (href_ === null) {
        continue;
      }

      if (isImage(href_)) {
        let ref = RelUrlToAbsUrl(href_);
        let file_name = "";
        if (message.is_serialized) {
          file_name = String(index) + "." + getExtension(ref);
        } else {
          let splited = ref.split("/");
          file_name = splited.slice(-1)[0];
        }
        notifyDownloadToBackground(ref, file_name);
        console.log(ref);
        img_refs.push(ref);
        index++;
      }
    }
    if (img_refs.length === 0) {
      console.log("リンク先に画像がありませんでした");
    }

    //<img>を検索
    const imgs = document.getElementsByTagName("img");
    let img_srcs = new Array();

    for (var i = 0; i < imgs.length; i++) {
      let href_ = imgs[i].getAttribute("href");
      if (href_ === null) {
        continue;
      }

      if (
        href_.includes("png") ||
        href_.includes("jpeg") ||
        href_.includes("jpg")
      ) {
        let src = RelUrlToAbsUrl(imgs[i].getAttribute("src"));
        console.log(src);
        img_srcs.push(src);
        //downloadImg(src, "hoge");
      }
    }
    if (img_srcs.length === 0) {
      console.log("imgタグがありませんでした");
    }
    console.log("終了");
    console.log(img_refs);
    console.log(img_srcs);
    /*
      let xhr = new XMLHttpRequest();
      xhr.open('GET', src, true);
      xhr.responseType = "blob";
      xhr.onload = downloadImageToLocal;
      xhr.send();
      */
  });
})();