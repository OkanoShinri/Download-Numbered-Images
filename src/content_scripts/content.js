(function () {
  //グローバルなガード変数をチェック、設定する
  if (window.hasRun) {
    return;
  }
  window.hasRun = true;
  window.is_runnning = false;
  const img_extentions = ["png", "jpeg", "jpg", "gif", "svg", "bmp", "webp"];
  const img_content_type = [
    "image/png",
    "image/jpeg",
    "image/jpeg",
    "image/gif",
    "image/svg+xml",
    "image/bmp",
    "image/webp",
  ];

  browser.runtime.onMessage.addListener((message) => {
    if (window.is_runnning || !message.command == "send_download_data") {
      return;
    }

    window.is_runnning = true;
    if (message.command == "send_download_data") {
      browser.storage.local
        .get()
        .then((restoredSettings) => {
          const config = {
            is_serialized: restoredSettings.is_serialized,
            rm_ngwords: restoredSettings.rm_ngwords,
            legal_img_extentions: restoredSettings.img_extentions,
            ng_words: restoredSettings.ng_words,
            download_folder: restoredSettings.download_folder,
            download_all: restoredSettings.download_all,
            timeout: restoredSettings.timeout,
          };
          let is_select_mode = false;

          console.log("START");
          if (config.download_all) {
            console.log("フルダウンロードモード:ON");
          }
          addProgressBar();

          var selection = window.getSelection();
          //documentが無ければframeを探す
          if (selection.type !== "Range") {
            let frame_elements = document.getElementsByTagName("frame");
            for (let i = 0; i < frame_elements.length; i++) {
              try {
                let frame_document = frame_elements[i].contentDocument;
                selection = frame_document.getSelection();
                if (selection !== null && selection.type === "Range") {
                  break;
                }
              } catch (error) {
                console.error(error);
                continue;
              }
            }
          }
          //iframeにも対応させたい
          /*
        if (selection.type !== "Range") {
          let iframe_elements = document.getElementsByTagName("iframe");
          for (let i = 0; i < iframe_elements.length; i++) {
            let iframe_document = iframe_elements[i].contentDocument;
            if (iframe_document === null) {
              continue;
            }
            let selection_ = iframe_document.getSelection();
            if (selection_ !== null && selection_.type === "Range") {
              selection = selection_;
              break;
            }

            //selection = iframe_document.getSelection();
            //console.error(error);
            //continue;
          }
        }
        */

          var element_and_urls = new Array();
          if (selection.type === "Range") {
            is_select_mode = true;
            element_and_urls = zipURLAndElementFromSelectArea(
              config,
              selection
            );
          } else {
            element_and_urls = zipURLAndElement(config);
          }

          getValidURLs(element_and_urls, config)
            .then((results) => {
              let count = 0;

              for (let i = 0; i < results.length; i++) {
                const result = results[i];
                if (result !== "") {
                  if (config.is_serialized) {
                    let file_name = getFileName(
                      result[0],
                      result[1],
                      true,
                      count
                    );
                    download(result[0], file_name, config.download_folder);
                  }
                  count++;
                }
              }

              if (count === 0) {
                let area = is_select_mode ? "選択範囲" : "このページ";
                browser.runtime.sendMessage({
                  command: "notice",
                  text:
                    area +
                    "にはダウンロードできる画像がありませんでした\n\nオプション内の除外ワードも確認してください",
                });
              }
              console.log("END");
              removeProgressBar();
              window.is_runnning = false;
            })
            .catch((e) => {
              window.is_runnning = false;
              console.error(`Failed : ${e.message}`);
              browser.runtime.sendMessage({
                command: "notice",
                text: e.message,
              });
              for (let index = 0; index < element_and_urls.length; index++) {
                const element = element_and_urls[index][1];
                if (
                  element.style.outline == "blue dashed 2px" ||
                  element.style.outline == "green dashed 2px"
                ) {
                  element.style.outline = "";
                }
              }
              removeProgressBar();
            });
        })
        .catch((e) => {
          window.is_runnning = false;
          console.error(`Failed : ${e.message}`);
          browser.runtime.sendMessage({
            command: "notice",
            text: e.message,
          });
          removeProgressBar();
        });
    } else if (message.command == "send_single_download_data") {
      browser.storage.local
        .get()
        .then((restoredSettings) => {
          const download_folder = restoredSettings.download_folder;
          const timeout = restoredSettings.timeout;

          let urls = new Array();

          let link_url = getLargeURL(message.link_url);
          urls.push(link_url);
          let src_url = getLargeURL(message.src_url);
          if (link_url !== src_url) {
            urls.push(src_url);
          }
          getExtentionsFromUrl(urls, timeout)
            .then((extentions) => {
              if (extentions[0] !== "") {
                let filename1 = getFileName(link_url, extentions[0], false, 0);
                download(link_url, filename1, download_folder);
              }
              if (extentions.length > 1 && extentions[1] !== "") {
                let filename2 = getFileName(src_url, extentions[1], false, 0);
                download(src_url, filename2, download_folder);
              }
              window.is_runnning = false;
            })
            .catch((e) => {
              window.is_runnning = false;
              console.error(`Failed : ${e.message}`);
              browser.runtime.sendMessage({
                command: "notice",
                text: e.message,
              });
            });
        })
        .catch((e) => {
          window.is_runnning = false;
          console.error(`Failed : ${e.message}`);
          browser.runtime.sendMessage({
            command: "notice",
            text: e.message,
          });
        });
    }
  });

  //エレメントとそこに含まれるURLをまとめたデータ形式を作る
  function zipURLAndElement(config) {
    let tags_ = ["a", "img", "source"];
    if (config.download_all) {
      tags_ = ["html", "body", "a", "img", "source", "div"];
    }
    const tags = tags_;
    let url_and_p_elements = new Array();
    let url_wo_duplicate = new Array();

    //全ての指定タグについて、エレメントを取得
    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i];

      //普通にタグで取得
      let from_document = document.getElementsByTagName(tag);
      for (let j = 0; j < from_document.length; j++) {
        let element = from_document[j];
        let urls_ = extractURLs(element, url_wo_duplicate, config);
        let urls = urls_[0];
        url_wo_duplicate = urls_[1];
        if (urls.length > 0) {
          for (let k = 0; k < urls.length; k++) {
            url_and_p_elements.push([urls[k], element]);
          }
        }
      }

      //iframe内の要素も取得
      let iframe_elements = document.getElementsByTagName("iframe");
      for (let j = 0; j < iframe_elements.length; j++) {
        /*
        try {
          let iframe_document = iframe_elements[j].contentDocument;
          var from_iframe = iframe_document.getElementsByTagName(tag);
        } catch (error) {
          console.error(error);
          continue;
        }
        //結局contentDocumentがクロスドメインのときはnullが返るとした
        */
        let iframe_document = iframe_elements[j].contentDocument;
        if (iframe_document === null) {
          continue;
        }
        let from_iframe = iframe_document.getElementsByTagName(tag);
        for (let k = 0; k < from_iframe.length; k++) {
          let element = from_iframe[k];
          let urls_ = extractURLs(element, url_wo_duplicate, config);
          let urls = urls_[0];
          url_wo_duplicate = urls_[1];
          if (urls.length > 0) {
            for (let k = 0; k < urls.length; k++) {
              url_and_p_elements.push([urls[k], element]);
            }
          }
        }
      }

      //frame内の要素も取得
      //個人サイトとかでは未だに使われている
      let frame_elements = document.getElementsByTagName("frame");
      for (let j = 0; j < frame_elements.length; j++) {
        try {
          let frame_document = frame_elements[j].contentDocument;
          var from_frame = frame_document.getElementsByTagName(tag);
        } catch (error) {
          console.error(error);
          continue;
        }

        for (let k = 0; k < from_frame.length; k++) {
          let element = from_frame[k];
          let urls_ = extractURLs(element, url_wo_duplicate, config);
          let urls = urls_[0];
          url_wo_duplicate = urls_[1];
          if (urls.length > 0) {
            for (let k = 0; k < urls.length; k++) {
              url_and_p_elements.push([urls[k], element]);
            }
          }
        }
      }
    }

    return url_and_p_elements; //url重複無し!
  }

  //エレメントとそこに含まれるURLをまとめたデータ形式を作る
  //選択範囲バージョン
  function zipURLAndElementFromSelectArea(config, selection) {
    let tags_ = ["a", "img", "source"];
    if (config.download_all) {
      tags_ = ["html", "body", "a", "img", "source", "div"];
    }
    const tags = tags_;
    let ranges = new Array();
    let url_and_p_elements = new Array();
    let url_wo_duplicate = new Array();

    for (let i = 0; i < selection.rangeCount; i++) {
      ranges.push(selection.getRangeAt(i).cloneContents());
    }

    //基本的にrangeは要素一つ。Firefoxだけ複数のrangeをサポートしている
    for (let index = 0; index < ranges.length; index++) {
      const fragment = ranges[index];

      //実質ここから考えればよい
      for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];

        let from_select_document = fragment.querySelectorAll(tag);
        for (let j = 0; j < from_select_document.length; j++) {
          let element = from_select_document[j];
          let urls_ = extractURLs(element, url_wo_duplicate, config);
          let urls = urls_[0];
          url_wo_duplicate = urls_[1];
          if (urls.length > 0) {
            for (let k = 0; k < urls.length; k++) {
              url_and_p_elements.push([urls[k], element]);
            }
          }
        }
      }
    }

    return url_and_p_elements; //url重複無し!
  }

  //エレメントに含まれるURLをリストで返す
  function extractURLs(element, url_wo_duplicate, config) {
    element.dispatchEvent(new Event("mousedown"));
    let attribute_names_ = ["href", "src", "srcset"];
    if (config.download_all) {
      attribute_names_ = ["href", "src", "srcset", "style", "background"];
    }
    const attribute_names = attribute_names_;
    const attributes = element.attributes;
    if (attributes.length === 0) {
      return ["", url_wo_duplicate];
    }
    let urls = new Array();
    for (let i = 0; i < attributes.length; i++) {
      if (!attribute_names.includes(attributes.item(i).name)) {
        continue;
      }
      let value = "";
      try {
        value = decodeURIComponent(attributes.item(i).value);
      } catch (e) {
        continue;
      }

      let url = relUrlToAbsUrl(value);

      //先頭のhttp以外でhttpから始まる画像リンクがあれば、そちらを優先する
      let link = url.slice(4).match(/http.*?(.png|.jpg|.jpeg|.gif|.svg)/g);
      if (link !== null) {
        console.log(`refer ${link[0]} insdead of ${url}`);
        url = link[0];
      }

      url = getLargeURL(url);

      if (!config.download_all && url.includes("data:image")) {
        url = "";
      }
      if (config.download_all) {
        let url_ = value.match(/url\(.+?\)/g);
        if (url_ !== null) {
          url = url_[0].split(" ").join("").slice(5).slice(0, -2); //.slice(4).slice(0, -1);でないのは、両端の"を除くため        }
        }
      }

      //urlが空でなくて、重複もしてなくて、(除外モードオンでかつNGワードを含む)でないとき
      if (
        url !== "" &&
        !url_wo_duplicate.includes(url) &&
        !shouldRemove(url, config.ng_words, config.rm_ngwords)
      ) {
        urls.push(url);
        url_wo_duplicate.push(url);
      }
    }

    //CSSからも取得
    if (config.download_all) {
      let style = window.getComputedStyle(element);
      if (style.getPropertyValue("background-image") !== null) {
        let url = style
          .getPropertyValue("background-image")
          .split(" ")
          .join("")
          .slice(5)
          .slice(0, -2);
        if (url !== "" && !url_wo_duplicate.includes(url)) {
          urls.push(url);
          url_wo_duplicate.push(url);
        }
      }
    }
    return [urls, url_wo_duplicate];
  }

  //相対パスを絶対パスに変換する
  function relUrlToAbsUrl(url) {
    if (url.slice(0, 2) === "//") {
      const protocol = window.location.href.split("//")[0];
      return protocol + url;
    }
    let temp = document.createElement("a");
    temp.href = url;

    return temp.href;
  }

  //渡されたurlのうち、画像を示すもののindexとその拡張子をまとめたリストを返す
  async function getValidURLs(element_and_urls, config) {
    const step = 100 / element_and_urls.length;

    const new_urls = await Promise.all(
      element_and_urls.map(async (element_and_url) => {
        const url = element_and_url[0];
        const element = element_and_url[1];

        //探索前に
        element.style.outline = "green dashed 2px";

        //掲示板は大量アクセスに敏感なので、画像のアテがなければ早めに切り上げておく
        //HEADメソッドなら大丈夫なのかな？
        if (
          url.toLowerCase().includes("5ch") ||
          url.toLowerCase().includes("2ch") ||
          url.toLowerCase().includes("bbs")
        ) {
          let include_extention = false;
          for (let index = 0; index < img_extentions.length; index++) {
            if (url.includes(img_extentions[index])) {
              include_extention = true;
            }
          }
          if (!include_extention) {
            updateProgressBar(step);
            element.style.outline = "";
            return "";
          }
        }

        //タイムアウト実装
        const abort_controller = new AbortController();
        const timeout = window.setTimeout(() => {
          abort_controller.abort();
          console.log(`Connection to ${url} timed out.`);
        }, Number(config.timeout) * 1000);
        const fetch_result = await fetch(url, {
          method: "HEAD",
          signal: abort_controller.signal,
        }).catch(() => new Response());
        window.clearTimeout(timeout);

        let content_type = fetch_result.headers.get("Content-Type");
        if (content_type === null) {
          updateProgressBar(step);
          element.style.outline = "";
          return "";
        }
        content_type = content_type.split(";")[0]; //image/jpeg; charset=UTF-8 のように後ろに何かつくこともあるので
        for (let i = 0; i < img_content_type.length; i++) {
          if (img_content_type[i] === content_type) {
            //拡張子がNGワードに入っていないか？
            if (
              includeNgWords(
                "." + img_extentions[i],
                config.ng_words,
                config.rm_ngwords
              )
            ) {
              break;
            }

            updateProgressBar(step);
            element.style.outline = "blue dashed 2px";
            if (!config.is_serialized) {
              let file_name = getFileName(url, img_extentions[i], false, 0);
              download(url, file_name, config.download_folder);
            }
            return [url, img_extentions[i]];
          }
        }
        //無かった
        updateProgressBar(step);
        element.style.outline = "";

        return "";
      })
    );

    for (let index = 0; index < element_and_urls.length; index++) {
      if (
        element_and_urls[index][1].style.outline == "blue dashed 2px" ||
        element_and_urls[index][1].style.outline == "green dashed 2px"
      ) {
        element_and_urls[index][1].style.outline = "";
      }
    }

    return new_urls;
  }

  //そのURLが事前に取り除けるか確認する
  function shouldRemove(url, ng_words, rm_ngwords) {
    if (includeNgWords(url, ng_words, rm_ngwords) || removeImgForFanbox(url)) {
      return true;
    }
    return false;
  }

  //NGワードにヒットするかを判定
  function includeNgWords(url, ng_words, rm_ngwords) {
    for (let i = 0; i < ng_words.length; i++) {
      let ng_word = ng_words[i];
      if (ng_word.slice(0, 1) === "/" && ng_word.slice(-1) === "/") {
        ng_word = ng_word.slice(1).slice(0, -1);
        ng_word = new RegExp(ng_word);
      }
      if (rm_ngwords && url.match(ng_word) !== null) {
        console.log(`${url} was skipped because it includes "${ng_word}"`);
        return true;
      }
    }
    return false;
  }

  //FANBOX用に重複画像を除く
  function removeImgForFanbox(url) {
    if (url.includes("/w/1200/")) {
      console.log(
        `${url} was skipped because the same image exists on the page.`
      );
      return true;
    }
    return false;
  }

  //ダウンロードのメイン関数
  //backgroundにダウンロードコマンドを送る
  function download(url, file_name, download_folder) {
    let formatted = formatBeforeDownload(download_folder, file_name);
    let new_file_name = formatted[0];
    let new_file_name_wo_directory = formatted[1];

    browser.runtime.sendMessage({
      command: "download",
      url: url,
      filename: new_file_name,
    });
    console.log(`download ${new_file_name_wo_directory} from ${url}`);
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
  function formatBeforeDownload(download_folder, file_name) {
    let title = document.title;
    if (title === "") {
      title = window.location.href.split("/").pop().split("?")[0];
    }
    title = removeSymbols(title);

    download_folder = download_folder
      .replace(/\/+$/, "") //パスの末尾の"/"は除いておく
      .replace("{title}", title); //{title}を置き換える

    let file_name_wo_directory = file_name;
    file_name = download_folder + "/" + file_name;
    return [file_name, file_name_wo_directory];
  }

  function getLargeURL(url) {
    if (url.includes("imgur")) {
      //Imgur
      url = url.replace(/(\/.{7})[sbtmlh]\./, function () {
        return arguments[1] + ".";
      });
    }
    if (url.includes("wikimedia")) {
      //Wikimedia
      url = url.replace("thumb/", "");
      let extention = url.slice(-4);
      let re = new RegExp(extention, "g");
      if (url.match(re).length > 1) {
        let url_ = url.split("/");
        url_.pop();
        url = url_.join("/");
      }
    }
    if (url.includes("twi")) {
      //Twitter
      url = url.replace(/name=.*/, "name=orig");
    }
    if (url.includes("nijie")) {
      //Nijie
      url = url.replace(/__rs_l\d+x\d+\//, "");
    }
    if (url.includes("ytimg")) {
      //YouTube
      url = url.replace(/\?.*/, "");
    }
    if (url.includes("media-amazon")) {
      //Amazon
      url = url.replace(/_AC_S.*_\./, "_AC_SL1500_.");
    }
    return url;
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
      
      こんな感じのを試したが、<frameset>があるサイトではうまく動かなかった。
      最終手段・bodyの外に書く
      一応これでも動くことには動く
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
    let bar = document.getElementById("EasyImgDownloader-ProgressBar");
    if (bar !== null) {
      bar.remove();
    }
  }

  async function getExtentionsFromUrl(urls, timeout_second) {
    const Extentions = await Promise.all(
      urls.map(async (url) => {
        //タイムアウト実装
        const abort_controller = new AbortController();
        const timeout = window.setTimeout(() => {
          abort_controller.abort();
          console.log(`Connection to ${url} timed out.`);
        }, Number(timeout_second) * 1000);
        const fetch_result = await fetch(url, {
          method: "HEAD",
          signal: abort_controller.signal,
        }).catch(() => new Response());
        window.clearTimeout(timeout);

        let content_type = fetch_result.headers.get("Content-Type");
        for (let i = 0; i < img_content_type.length; i++) {
          if (img_content_type[i] === content_type) {
            return img_extentions[i];
          }
        }
        return "";
      })
    );
    return Extentions;
  }
})();
