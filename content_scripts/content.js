(function () {
  //グローバルなガード変数をチェック、設定する
  if (window.hasRun) {
    return;
  }
  window.hasRun = true;
  const img_extentions = ["png", "jpeg", "jpg", "gif"];
  var ng_words = [];
  var download_folder;
  //ストレージ空の読み込みは非同期なので、多少ずれがある
  //「連番化するか」と「除外ワードを除くか」はポップアップの状態を優先する

  //このスクリプトが実行されたとき、設定をストレージから読み取る
  //今は「ポップアップメニューを開いたとき」と「コンテキストメニューを開いたとき」
  browser.storage.local
    .get()
    .then((restoredSettings) => {
      ng_words = restoredSettings.ng_words;
      download_folder = restoredSettings.download_folder;
    })
    .catch((e) => {
      console.error(`Failed : ${e.message}`);
    });

  //popuo.jsやbackground.jsからメッセージを受け取った時の行動を設定
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
    return true;
  });

  //相対パスを絶対パスに変換する
  function relUrlToAbsUrl(url) {
    if (!url.includes("http")) {
      var temp = document.createElement("a");
      temp.href = url;
      return temp.href;
    } else {
      return url;
    }
  }

  //Twitterで画像サイズをオリジナルサイズに変換する
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

  // background-scriptにダウンロードコマンドを送信
  function notifyDownloadToBackground(url, filename) {
    //TwitterとかだとタイトルにURLが含まれていたりするので、取り除く
    let title = document.title.replace(/http.*/g, "");

    title = removeSymbols(title);
    //ダウンロードフォルダを設定できるようにしたいので、
    //ファイル名の"/"を除外したあとでダウンロードフォルダのパスを繋げる
    let download_folder_ = download_folder.replace("{title}", title);
    browser.runtime.sendMessage({
      command: "download",
      url: url,
      filename: filename,
      folder: download_folder_,
    });
  }

  //ファイル名に使えない文字を取り除く("_"に変換する)
  function removeSymbols(url) {
    let marks = [" ", "/", "\\", ":", "*", "?", "<", ">", "|"];
    for (var i = 0; i < marks.length; i++) {
      url = url.split(marks[i]).join("_");
    }
    return url;
  }

  //urlが画像のものかを判断する
  //TODO: リンクに拡張子が含まれていない場合
  function isImage(url) {
    for (let i = 0; i < img_extentions.length; i++) {
      if (url.includes(img_extentions[i])) {
        return true;
      }
    }
    return false;
  }

  //NGワードにヒットするかを判定
  //ヒットしたらtrueを返す
  function notMainContents(url) {
    for (let i = 0; i < ng_words.length; i++) {
      if (url.includes(ng_words[i])) {
        console.log(url + " was removed because it includes " + ng_words[i]);
        return true;
      }
    }
    return false;
  }

  //ファイルの拡張子を取得
  function getExtension(url) {
    //urlのドメインなどを取り除く
    let splited = url.split("/").slice(-1)[0];

    let entention = splited.split(".");
    if (entention.length > 1) {
      return entention.slice(-1)[0];
    } else {
      //twitter等
      for (let i = 0; i < img_extentions.length; i++) {
        if (url.includes("=" + img_extentions[i])) {
          return img_extentions[i];
        }
      }
      //TODO: 拡張子の推測
      return ".jpg";
    }
  }

  //ページ内の指定タグに含まれる画像を全てダウンロードする
  //通し番号を取得したいので、引数で渡す
  //実行後の通し番号は返り値で得る
  function downloadImageFromTag(message, tag, init_index = 0) {
    let index = init_index;
    let attribute = "href";
    if (tag == "img") {
      attribute = "src";
    }

    var imgs = [];

    //普通にタグで取得
    let elements = document.getElementsByTagName(tag);
    for (let i = 0; i < elements.length; i++) {
      imgs.push(elements[i]);
    }

    //frame内の要素も取得
    //個人サイトとかでは未だに使われている
    let frameElem = document.getElementsByTagName("frame");
    for (let i = 0; i < frameElem.length; i++) {
      let frameDocument = frameElem[i].contentDocument;
      let elements = frameDocument.getElementsByTagName(tag);
      for (let j = 0; j < elements.length; j++) {
        imgs.push(elements[j]);
      }
    }

    //const imgs = document.getElementsByTagName(tag);

    for (let i = 0; i < imgs.length; i++) {
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

      //完全なurlになったので、これ以降は変更しない
      const img_url = ref;

      let file_name = "";
      if (message.is_serialized) {
        file_name = String(index) + "." + getExtension(img_url);
      } else {
        //www.example.com/hoge/foo.png?bar=aaa&piyo=000
        //=>
        //foo.png
        let splited = img_url.split("/");
        file_name = splited.slice(-1)[0];
        file_name = file_name.split("?")[0];

        //拡張子がない場合、元のurlから推測する
        //TODO: 元のurlにもない場合
        if (!file_name.includes(".")) {
          file_name = file_name + "." + getExtension(img_url);
        }
      }
      notifyDownloadToBackground(img_url, file_name);
      index++;
    }
    if (index - init_index === 0) {
      console.log('"' + tag + '" タグでは見つからなかったよ');
    }
    return index;
  }
})();
