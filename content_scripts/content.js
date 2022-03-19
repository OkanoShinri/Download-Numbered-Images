(function () {
  //グローバルなガード変数をチェック、設定する
  if (window.hasRun) {
    return;
  }
  window.hasRun = true;
  const img_extentions = ["png", "jpeg", "jpg", "gif", "svg"];
  const img_content_type = [
    "image/png",
    "image/jpeg",
    "image/jpeg",
    "image/gif",
    "image/svg+xml",
  ];

  //ストレージ空の読み込みは非同期なので、多少ずれがある
  //「連番化するか」と「除外ワードを除くか」はポップアップの状態を優先する

  //popuo.jsやbackground.jsからメッセージを受け取った時の行動を設定
  browser.runtime.onMessage.addListener((message) => {
    if (
      message.command != "download" ||
      message.is_serialized == null ||
      message.rm_ngwords == null
    ) {
      return;
    }
    console.log("開始");

    addProgressBar();

    let index = 0;

    let elements_img_src = getMatchedElements("img", "src");
    let urls_img_src = getUrlsFromElements(elements_img_src, "src");
    let elements_div_style = getMatchedElements("div", "style");
    let urls_div_style = getUrlsFromElements(elements_div_style, "style");
    let elements_a_href = getMatchedElements("a", "href");
    let urls_a_href = getUrlsFromElements(elements_a_href, "href");
    let elements_a_style = getMatchedElements("a", "style");
    let urls_a_style = getUrlsFromElements(elements_a_style, "style");

    let elements_ = elements_img_src
      .concat(elements_div_style)
      .concat(elements_a_href)
      .concat(elements_a_style);
    let urls_ = urls_img_src
      .concat(urls_div_style)
      .concat(urls_a_href)
      .concat(urls_a_style);

    let elements = new Array();
    let urls = new Array();

    //重複するurlを取り除く
    for (let i = 0; i < elements_.length; i++) {
      if (!urls.includes(urls_[i])) {
        urls.push(urls_[i]);
        elements.push(elements_[i]);
      }
    }

    if (message.is_serialized) {
      getValidUrls(urls, elements, message).then((result) => {
        //resultはこんな型
        //[["url0", "jpg", element_0],["url1", "png", element_1],["url2", "jpg", element_2]]

        for (let i = 0; i < result.length; i++) {
          let url = result[i][0];
          let extention = result[i][1];
          let element = result[i][2];
          download(url, extention, index, element, message);
          index++;
        }
        if (index === 0) {
          browser.runtime.sendMessage({
            command: "no_img_notice",
          });
        }

        console.log("終了");
        removeProgressBar();
      });
    } else {
      downloadValidUrls(urls, elements, message).then((download_num) => {
        if (download_num === 0) {
          browser.runtime.sendMessage({
            command: "no_img_notice",
          });
        }

        console.log("終了");
        removeProgressBar();
      });
    }
    /**/
  });

  //指定されたタグを含むエレメントをリストにして返す
  function getMatchedElements(tag, attribute) {
    let elements = new Array();

    //普通にタグで取得
    let from_document = document.getElementsByTagName(tag);
    for (let i = 0; i < from_document.length; i++) {
      if (from_document[i].getAttribute(attribute) !== null) {
        elements.push(from_document[i]);
      }
    }

    //frame内の要素も取得
    //個人サイトとかでは未だに使われている
    let frame_elements = document.getElementsByTagName("frame");
    for (let i = 0; i < frame_elements.length; i++) {
      let frame_document = frame_elements[i].contentDocument;
      let from_frame = frame_document.getElementsByTagName(tag);
      for (let j = 0; j < from_frame.length; j++) {
        if (from_frame[i].getAttribute(attribute) !== null) {
          elements.push(from_frame[j]);
        }
      }
    }

    return elements;
  }

  //エレメントから画像のurlを抜き出す
  //エレメントがurlを含まない場合、空文字になる
  function getUrlsFromElements(elements, attribute) {
    let urls = new Array();
    if (elements.length === 0) {
      return urls;
    }

    for (let i = 0; i < elements.length; i++) {
      let value = elements[i].getAttribute(attribute);
      if (
        value === null ||
        value === "" ||
        extractUrlFromAttribute(attribute, value) === ""
      ) {
        urls.push("");
      } else {
        let url = extractUrlFromAttribute(attribute, value);
        urls.push(url);
      }
    }

    console.assert(elements.length === urls.length);
    return urls;
  }

  //渡されたurlのうち、画像を示すものを返す
  async function downloadValidUrls(urls, elements, message) {
    let download_list = new Array();
    const result = await Promise.all(
      urls.map(async (url, index, all) => {
        //urlが画像のもので、NGワードを含まなければその拡張子を返す
        //そうでないなら空文字を返す
        let extention = "";
        let step = 100 / all.length;
        let progress_bar = document.getElementById(
          "EasyImgDownloader-ProgressBar"
        );

        //探索前に
        elements[index].style.outline = "2px dashed green";

        if (
          url === "" ||
          (message.rm_ngwords && includeNgWords(url, message))
        ) {
          let current = Number(progress_bar.value) + step;
          progress_bar.value = String(current);
          elements[index].style.outline = "";
          return false;
        }

        //URLに拡張子を含む場合、それで判定
        for (let i = 0; i < img_extentions.length; i++) {
          if (
            url.includes("." + img_extentions[i]) ||
            url.includes("=" + img_extentions[i])
          ) {
            if (!message.img_extentions.includes(img_extentions[i])) {
              //httpチェックに回す
              break;
            }
            //OK
            let current = Number(progress_bar.value) + step;
            progress_bar.value = String(current);
            elements[index].style.outline = "2px dashed blue";
            extention = img_extentions[i];
            download_list.push(url);
            download(
              url,
              extention,
              download_list.length,
              elements[index],
              message
            );
            return true;
          }
        }

        const fetch_result = await fetch(url).catch(() => new Response());
        let content_type = fetch_result.headers.get("Content-Type");
        for (let i = 0; i < img_content_type.length; i++) {
          if (img_content_type[i] === content_type) {
            //urlは画像のもの

            //拡張子はオプションで設定できる
            //その拡張子がOKか確認
            if (!message.img_extentions.includes(img_extentions[i])) {
              continue;
            }
            //OK
            let current = Number(progress_bar.value) + step;
            progress_bar.value = String(current);
            elements[index].style.outline = "2px dashed blue";
            extention = img_extentions[i];
            download_list.push(url);
            download(
              url,
              extention,
              download_list.length,
              elements[index],
              message
            );
            return true;
          }
        }
        //無かった
        let current = Number(progress_bar.value) + step;
        progress_bar.value = String(current);
        elements[index].style.outline = "";
        return false;
      })
    );

    let download_num = 0;
    for (let i = 0; i < result.length; i++) {
      if (result[i]) {
        download_num++;
      }
    }

    return download_num;
  }

  //渡されたurlのうち、画像を示すものを返す
  async function getValidUrls(urls, elements, message) {
    let result = new Array();
    //const extentions = await Promise.all(urls.map(isValid));
    const extentions = await Promise.all(
      urls.map(async (url, index, all) => {
        //urlが画像のもので、NGワードを含まなければその拡張子を返す
        //そうでないなら空文字を返す
        let extention = "";
        let step = 100 / all.length;
        let progress_bar = document.getElementById(
          "EasyImgDownloader-ProgressBar"
        );

        //探索前に
        elements[index].style.outline = "2px dashed green";

        if (
          url === "" ||
          url.includes("logout") || //logoutリンクを踏んでしまうとその場でアウト
          (message.rm_ngwords && includeNgWords(url, message))
        ) {
          let current = Number(progress_bar.value) + step;
          progress_bar.value = String(current);
          elements[index].style.outline = "";
          return extention;
        }

        //URLに拡張子を含む場合、それで判定
        for (let i = 0; i < img_extentions.length; i++) {
          if (
            url.includes("." + img_extentions[i]) ||
            url.includes("=" + img_extentions[i])
          ) {
            if (!message.img_extentions.includes(img_extentions[i])) {
              break;
            }
            //OK
            let current = Number(progress_bar.value) + step;
            progress_bar.value = String(current);
            elements[index].style.outline = "2px dashed blue";
            extention = img_extentions[i];
            return extention;
          }
        }

        const fetch_result = await fetch(url).catch(() => new Response());
        let content_type = fetch_result.headers.get("Content-Type");
        for (let i = 0; i < img_content_type.length; i++) {
          if (img_content_type[i] === content_type) {
            //urlは画像のもの

            //拡張子はオプションで設定できる
            //その拡張子がOKか確認
            if (!message.img_extentions.includes(img_extentions[i])) {
              continue;
            }
            elements[index].style.outline = "2px dashed blue";
            extention = img_extentions[i];
            break;
          }
        }
        let current = Number(progress_bar.value) + step;
        progress_bar.value = String(current);
        if (extention === "") {
          elements[index].style.outline = "";
        }
        return extention;
      })
    );

    for (let i = 0; i < urls.length; i++) {
      if (extentions[i] !== "") {
        result.push([urls[i], extentions[i], elements[i]]);
      }
    }
    return result;
    //resultはこんな型
    //[["url0", "jpg", element_0],["url1", "png", element_1],["url2", "jpg", element_2]]
  }

  //getAttribute()で取ってきたvalueとそのattributeを引数に取り、valueに含まれるURLを返す
  function extractUrlFromAttribute(attribute, value) {
    switch (attribute) {
      case "href":
        var url = relUrlToAbsUrl(value);
        if (url.includes("http")) {
          return url;
        }
        break;
      case "src":
        var url = relUrlToAbsUrl(value);
        if (url.includes("http")) {
          return url;
        }
        break;
      case "style":
        if (value.includes("background-image")) {
          let background_image = value.match(/url\(.+?\)/g);
          if (background_image !== null) {
            var url = background_image[0]
              .split(" ")
              .join("")
              .slice(5)
              .slice(0, -2); //.slice(4).slice(0, -1);でないのは、両端の"を除くため
            url = relUrlToAbsUrl(url);
            if (url.includes("http")) {
              return url;
            }
          }
        }
        break;
      default:
        return "";
    }
    return "";
  }

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

  //NGワードにヒットするかを判定
  //ヒットしたらtrueを返す
  function includeNgWords(url, message) {
    for (let i = 0; i < message.ng_words.length; i++) {
      if (url.includes(message.ng_words[i])) {
        console.log(
          url + " was removed because it includes " + message.ng_words[i]
        );
        return true;
      }
    }
    return false;
  }

  //適切なファイル名を設定し、ダウンロードコマンドを送る
  function download(url, extention, index, element, message) {
    if (url.includes("twi")) {
      url = getOrigUrlForTwitter(url);
    }
    let file_name = getFileName(url, extention, message.is_serialized, index);
    file_name = removeSymbols(file_name);
    notifyDownloadToBackground(url, file_name, element, message);
  }

  //urlから正しいファイル名を付ける
  //特に、ファイル名の拡張子ではなく、HTTPヘッダーに基づいた拡張子に直す
  function getFileName(url, extention, is_serialized, index) {
    let file_name = "";
    if (is_serialized) {
      file_name = String(index) + "." + extention;
    } else {
      //www.example.com/hoge/foo.png?bar=aaa&piyo=000
      //=>
      //foo.png
      file_name = url.split("/").pop().split("?")[0];

      //正しい拡張子を付ける
      if (!file_name.includes(".")) {
        file_name = file_name + "." + extention;
      } else {
        let file_name_ = file_name.split(".");
        file_name_.pop();
        file_name = file_name_.join(".") + "." + extention;
      }
    }
    return file_name;
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
  function notifyDownloadToBackground(url, filename, element, message) {
    //TwitterとかだとタイトルにURLが含まれていたりするので、取り除く
    let title = document.title.replace(/http.*/g, "");
    if (title === "") {
      title = window.location.href.split("/").pop().split("?")[0];
    }

    title = removeSymbols(title);
    //ダウンロードフォルダを設定できるようにしたいので、
    //ファイル名の"/"を除外したあとでダウンロードフォルダのパスを繋げる

    //あとで"/"で繋げるので、パスの末尾の"/"は除いておく
    let download_folder = message.download_folder
      .replace(/\/+$/, "")
      .replace("{title}", title);
    browser.runtime.sendMessage({
      command: "download",
      url: url,
      filename: filename,
      folder: download_folder,
    });
    element.style.outline = "";
    console.log("download " + filename + " from " + url);
  }

  //ファイル名に使えない文字を取り除く("_"に変換する)
  function removeSymbols(text) {
    let marks = [" ", "/", "\\", ":", "*", "?", "<", ">", "|"];
    for (var i = 0; i < marks.length; i++) {
      text = text.split(marks[i]).join("_");
    }
    return text;
  }
  function addProgressBar() {
    let progress_bar = document.createElement("progress");
    progress_bar.id = "EasyImgDownloader-ProgressBar";
    progress_bar.max = "100";
    progress_bar.value = "0";
    progress_bar.style =
      "width:100%; position: fixed; top: 0px; left: 0px; z-index: 99999;";

    let body = document.getElementsByTagName("body");
    if (body.length === 0) {
      /*
      let frame = document.getElementsByTagName("frameset");
      frame[0].appendChild(progress_bar);
      
      //こんな感じのを試したが、<frameset>があるサイトではうまく動かなかった。
      //最終手段・bodyの外に書く
      //一応これでも動くことには動く
      */
      let html_elements = document.getElementsByTagName("html");
      html_elements[0].appendChild(progress_bar);
    } else {
      body[0].appendChild(progress_bar);

      //最終手段・bodyの外に書く
      //一応これでも動くことには動く
      //let html_elements = document.getElementsByTagName("html");
      //html_elements[0].appendChild(progress_bar);
    }
  }
  function removeProgressBar() {
    document.getElementById("EasyImgDownloader-ProgressBar").remove();
  }

  /*
  以下は過去のコード
  urlに含まれる拡張子から画像を判断する
  利点
  - 早い
  欠点
  - urlに拡張子を含まない場合に保存できない
  - 画像でなくともpngなどのフレーズを含んでいるとダウンロードしてしまう
  */

  /*
  使い方：
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
   */

  /*
  //urlに画像拡張子が含まれているならそれを返す
  //含まれていなければ空文字を返す
  function includeImgExtention(url) {
    for (let i = 0; i < img_extentions.length; i++) {
      if (url.includes(img_extentions[i])) {
        return img_extentions[i];
      }
    }
    return "";
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

    for (let i = 0; i < imgs.length; i++) {
      let src_ = imgs[i].getAttribute(attribute);
      if (src_ === null) {
        continue;
      }

      let url = relUrlToAbsUrl(src_);

      let extention = includeImgExtention(url);
      if (extention === "") {
        continue;
      }
      if (message.rm_ngwords && includeNgWords(url, message)) {
        continue;
      }

      download(url, extention, index, message);
      index++;
    }
    if (index - init_index === 0) {
      console.log('"' + tag + '" タグでは見つからなかったよ');
    }
    return index;
  }
  */
})();
