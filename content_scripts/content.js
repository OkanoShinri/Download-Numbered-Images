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

  browser.runtime.onMessage.addListener((message) => {
    if (
      message.command != "download" ||
      message.is_serialized == null ||
      message.rm_ngwords == null ||
      message.img_extentions == null ||
      message.ng_words == null ||
      message.download_folder == null
    ) {
      return;
    }
    console.log("開始");
    addProgressBar();

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

    let download_now = !message.is_serialized; //連番化の手間がないので、即時ダウンロード
    getIndicesOfValidUrls(urls, elements, message, download_now).then(
      (results) => {
        //resultは[[index,extention]]
        //[[0, "jpg"],["1", "png"],["4", "jpg"]]

        if (results.length === 0) {
          browser.runtime.sendMessage({
            command: "no_img_notice",
          });
        } else if (!download_now) {
          //ダウンロードしていないときはここで連番づけてダウンロード
          for (let i = 0; i < results.length; i++) {
            let result = results[i];
            let index = result[0];
            let extention = result[1];

            let url = urls[index];
            let file_name = getFileName(
              url,
              extention,
              message.is_serialized,
              i
            );
            download(url, file_name, message.download_folder);
            elements[index].style.outline = "";
          }
        }

        console.log("終了");
        removeProgressBar();
      }
    );
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

  //getAttribute()で取ってきたvalueとそのattributeを引数に取り、valueに含まれるURLを返す
  function extractUrlFromAttribute(attribute, value) {
    let url = "";
    switch (attribute) {
      case "href":
        url = relUrlToAbsUrl(value);
        return url;

      case "src":
        url = relUrlToAbsUrl(value);
        return url;

      case "style":
        if (value.includes("background-image")) {
          let background_image = value.match(/url\(.+?\)/g);
          if (background_image !== null) {
            url = background_image[0].split(" ").join("").slice(5).slice(0, -2); //.slice(4).slice(0, -1);でないのは、両端の"を除くため
            url = relUrlToAbsUrl(url);
          }
        }
        return url;

      default:
        return url;
    }
  }

  //相対パスを絶対パスに変換する
  function relUrlToAbsUrl(url) {
    if (!url.includes("http")) {
      let temp = document.createElement("a");
      temp.href = url;
      return temp.href;
    } else {
      return url;
    }
  }

  //渡されたurlのうち、画像を示すもののindexとその拡張子をまとめたリストを返す
  async function getIndicesOfValidUrls(urls, elements, message, download_now) {
    let result = new Array();
    const extentions = await Promise.all(
      //urlが画像のもので、NGワードを含まなければその拡張子を返す
      //そうでないなら空文字を返す
      urls.map(async (url, index, all) => {
        let step = 100 / all.length;

        //探索前に
        elements[index].style.outline = "2px dashed green";

        if (
          url === "" ||
          url.toLowerCase().includes("logout") || //logoutリンクを踏んでしまうとその場でアウト
          url.toLowerCase().includes("signout") ||
          (message.rm_ngwords && includeNgWords(url, message))
        ) {
          updateProgressBar(step);
          elements[index].style.outline = "";
          return "";
        }

        const fetch_result = await fetch(url).catch(() => new Response());
        let content_type = fetch_result.headers.get("Content-Type");
        if (content_type === null) {
          return "";
        }
        content_type = content_type.split(";")[0]; //image/jpeg; charset=UTF-8 のように後ろに何かつくこともあるので
        for (let i = 0; i < img_content_type.length; i++) {
          if (img_content_type[i] === content_type) {
            //urlは画像のもの

            //拡張子はオプションで設定できる
            //その拡張子がOKか確認
            if (!message.img_extentions.includes(img_extentions[i])) {
              continue;
            }
            //OK
            updateProgressBar(step);
            elements[index].style.outline = "2px dashed blue";
            if (download_now) {
              let file_name = getFileName(url, img_extentions[i], false, 0);
              download(url, file_name, message.download_folder);
              elements[index].style.outline = "";
            }
            return img_extentions[i];
          }
        }
        //無かった
        updateProgressBar(step);
        elements[index].style.outline = "";

        return "";
      })
    );

    for (let i = 0; i < urls.length; i++) {
      if (extentions[i] !== "") {
        result.push([i, extentions[i]]);
      }
    }
    return result;
    //resultは[[index,extention]]
  }

  //NGワードにヒットするかを判定
  //ヒットしたらtrueを返す
  function includeNgWords(url, message) {
    for (let i = 0; i < message.ng_words.length; i++) {
      if (url.includes(message.ng_words[i])) {
        console.log(
          url + " was skipped because it includes " + message.ng_words[i]
        );
        return true;
      }
    }
    return false;
  }

  //ダウンロードのメイン関数
  //backgroundにダウンロードコマンドを送る
  function download(url, file_name, download_folder) {
    let formatted = formatBeforeDownload(url, download_folder, file_name);
    let new_url = formatted[0];
    let new_file_name = formatted[1];
    let new_file_name_wo_directory = formatted[2];

    browser.runtime.sendMessage({
      command: "download",
      url: new_url,
      filename: new_file_name,
    });
    console.log("download " + new_file_name_wo_directory + " from " + new_url);
  }

  //urlと拡張子からファイル名を生成する
  //連番化指定があるときはindexも渡す
  function getFileName(url, extention, is_serialized, index) {
    let file_name = "";
    if (is_serialized) {
      file_name = String(index) + "." + extention;
    } else if (url.includes("data:image/")) {
      file_name = "image." + extention;
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
    file_name = removeSymbols(file_name);
    return file_name;
  }

  //ファイル名の整理
  //twitterの画像をオリジナルに変えるのもここ
  function formatBeforeDownload(url, download_folder, file_name) {
    if (url.includes("twi")) {
      url = getOrigUrlForTwitter(url);
    }

    //TwitterとかだとタイトルにURLが含まれていたりするので、取り除く
    let title = document.title.replace(/http.*/g, "");
    if (title === "") {
      title = window.location.href.split("/").pop().split("?")[0];
    }
    title = removeSymbols(title);

    download_folder = download_folder
      .replace(/\/+$/, "") //パスの末尾の"/"は除いておく
      .replace("{title}", title); //{title}を置き換える

    let file_name_wo_directory = file_name;
    file_name = download_folder + "/" + file_name;
    return [url, file_name, file_name_wo_directory];
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

  //ファイル名に使えない文字を取り除く("_"に変換する)
  function removeSymbols(text) {
    let marks = [" ", "/", "\\", ":", "*", "?", "<", ">", "|"];
    for (let i = 0; i < marks.length; i++) {
      text = text.split(marks[i]).join("_");
    }
    return text;
  }

  //プログレスバー関係
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
    }
  }
  function updateProgressBar(step) {
    let progress_bar = document.getElementById("EasyImgDownloader-ProgressBar");
    let current = Number(progress_bar.value) + step;
    progress_bar.value = String(current);
  }
  function removeProgressBar() {
    document.getElementById("EasyImgDownloader-ProgressBar").remove();
  }
})();
