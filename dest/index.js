// ==UserScript==
// @name         DecorateYoutubeDesc
// @namespace    https://github.com/standstonecraft/DecorateYoutubeDesc
// @version      0.1
// @description  Editing date info, thumbnail image link, description link images.
// @author       Me
// @match        https://www.youtube.com/*
// @match        https://twitter.com/explore/tabs/trending
// @require      http://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js
// @require      https://gist.github.com/raw/2625891/waitForKeyElements.js
// @grant        GM_addStyle
// @grant        GM.xmlHttpRequest
// @grant        GM.setValue
// @grant        GM.getValue
// ==/UserScript==
'use strict';
// chrome-extension://dhdgffkkebhmkfjojejmpbldmpobfkfo/options.html#nav=9c337d74-2741-4d11-916d-ada65052271c+editor
/**
 *
 * 機能：
 * - タイトルの編集
 *   - 【～～】を検索キーワードとみなしてYoutube検索リンクに変換
 *   - 動画サムネイルを別タブ表示するリンクを追加
 * - 投稿日テキストの編集
 *   - ライブ放送・プレミア公開の場合は開始日時・終了日時・所要時間を表示、LIVEアイコンを表示
 * - 概要文の編集
 *   - 概要文上部に「一部を表示」ボタンを追加
 *   - 短縮URLを展開(下記リンクにも対応)
 *   - 動画リンクテキストをサムネイル画像に変換
 *   - チャンネルページへのリンクの編集
 *     - リンクテキストをチャンネルアイコンに変換
 *     - チャンネルページ内のリンクを追加
 *     - 生放送中の場合生放送ページへのリンクを追加
 * - ハッシュタグの編集
 *   - ハッシュタグリンクにTwitter検索リンク追加
 *   - 国内トレンド入りしているハッシュタグに順位を表示
 *   - ページ内に出現するハッシュタグに国内トレンド入りがあった場合タイトル上部に表示
 */
const decorateYoutubeDesc = () => {
  GM_addStyle(`
.miy-trendList {
  color: gold;
  margin-left: 4px;
  text-decoration: none;
}
.miy-hashtag {
  margin-left: 3px;
  color: gold;
  text-decoration: none;
}
.miy-splitted-title {
  display: inline;
}
.miy-thumbnailLink {
  margin-left: 6px;
  text-decoration: none;
}
.miy-downloadLink {
  margin-left: 6px;
  text-decoration: none;
  color: black;
  padding: 0 1rem 0 1rem;
  background-color: white;
  border-radius: 1rem;
}
.miy-liveState-streaming {
  border-width: medium;
  border-color: #ff4e45;
  border-style: solid;
  border-radius: 4px;
  color: #ff4e45;
  font-size: 0.8em;
  margin-left: 8px;
  padding-left: 4px;
  padding-right: 4px;
  text-decoration: none;
}
.miy-liveState-scheduled {
  border-width: medium;
  border-color: #ffd600;
  border-style: solid;
  border-radius: 4px;
  color: #ffd600;
  font-size: 0.8em;
  margin-left: 8px;
  padding-left: 4px;
  padding-right: 4px;
}
.miy-liveState-archived {
  border-width: medium;
  border-color: #646464;
  border-style: solid;
  border-radius: 4px;
  color: #646464;
  font-size: 0.8em;
  margin-left: 8px;
  padding-left: 4px;
  padding-right: 4px;
}
.miy-channelIcon {
  border-radius: 18px;
  vertical-align: bottom;
}
.miy-channnelLink {
  margin-left: 1rem;
  text-decoration: none;
  display: inline-block;
}
.miy-channnelLink > img {
  background-color: white;
  border-radius: 4px;
  padding: 2px;
  position: relative;
  vertical-align: text-bottom;
}
.miy-channnelLink > span {
  background-color: white;
  border-radius: 4px;
  color: #000000;
  margin-left: -0.6rem;
  padding-top: 2px;
  padding-right: 0.4rem;
  padding-bottom: 2px;
  padding-left: 0.7rem;
  vertical-align: text-bottom;
}
.miy-lessButton {
  cursor: pointer;
  display: block !important;
}
`);
  const TREND_STORE_KEY = 'stealTwitterTrends.trends';
  const SEC = 1000;
  const MIN = 60 * SEC;
  const youtubeBlock = _ => {
    //#region CLASSES
    class Tick {
      /** @type {number} */
      prev;
      /** @type {number} */
      interval;
      constructor(interval) {
        this.prev = 0;
        this.interval = interval;
      }
      /** @returns {boolean} */
      elapsed = () => new Date().getTime() - this.prev > this.interval;
      update = () => {
        this.prev = new Date().getTime();
      };
    }

    /**
     * チャンネルページ内のリンク情報
     */
    class ChannelLink {
      /** @type {string} */
      url;
      /** @type {string} */
      img;
      /** @type {string} */
      text;
      /**
       *
       * @param {string} url URL
       * @param {string} img 画像URL
       * @param {string} text リンクテキスト
       */
      constructor(url, img, text) {
        this.url = url;
        this.img = img;
        this.text = text;
      }
      /**
       *
       * @param {Element} aTagNode 概要文内のチャンネルへのハイパーリンク
       */
      insertChannelLink(aTagNode) {
        if (aTagNode.parentNode) {
          aTagNode.parentNode.insertBefore(
            (_ => {
              const aTag = document.createElement('a');
              aTag.href = this.url;
              aTag.target = '_blank';
              aTag.title = this.text;
              aTag.classList.add('myInsert', 'miy-channnelLink');

              aTag.append(
                (_ => {
                  const imgTag = document.createElement('img');
                  imgTag.src = this.img;
                  imgTag.height = 24;
                  return imgTag;
                })(),
                (_ => {
                  const span = document.createElement('span');
                  span.textContent = this.text;
                  return span;
                })()
              );
              return aTag;
            })(),
            aTagNode.nextSibling
          );
        } else {
          console.error(`error at insertChannelLink.`, { text: this.text, url: this.url });
        }
      }
    }
    /**
     * チャンネルのアイコン及びリンク集を保持する
     */
    class Channel {
      /** @type {string} */
      iconUrl;
      /** @type {ChannelLink[]} */
      links;
      /** @type {string} */
      liveUrl;

      /**
       *
       * @param {string} iconUrl
       */
      constructor(iconUrl) {
        this.iconUrl = iconUrl;
        this.links = [];
      }
      /**
       *
       * @param {Element} aTagNode 概要文内のチャンネルへのハイパーリンク
       */
      customiseHyperlink(aTagNode) {
        /**
         *
         * @param {Element} aTagNode 概要文内のチャンネルへのハイパーリンク
         */
        function insertChannelIcon(iconUrl, aTagNode) {
          aTagNode.text = '';
          aTagNode.insertBefore(
            (_ => {
              const iTag = document.createElement('img');
              iTag.src = iconUrl;
              iTag.height = 36;
              iTag.classList.add('myInsert', 'miy-channelIcon');
              return iTag;
            })(),
            aTagNode.firstChild
          );
        }
        insertChannelIcon(this.iconUrl, aTagNode);
        this.links.forEach(l => l.insertChannelLink(aTagNode));
        if (this.liveUrl) {
          aTagNode.parentNode.insertBefore(
            (_ => {
              const liveLink = document.createElement('a');
              liveLink.href = this.liveUrl;
              liveLink.append(document.createTextNode(DESC_LIVE_ICON_TEXT));
              liveLink.target = '_blank';
              liveLink.classList.add('myInsert', 'miy-liveState-streaming');
              return liveLink;
            })(),
            aTagNode.nextSibling
          );
        }
      }
    }
    //#endregion

    /** タイトルカッコ内区切り文字 */
    const TITLE_SPLITTER_IN_PAREN = /[、,＆　\/] ?/g;
    /** タイトル生放送アイコンテキスト */
    const TITLE_LIVE_ICON_TEXT = 'LIVE';
    /** 一部を表示ボタンテキスト */
    const LESS_BUTTON_TEXT = '一部を表示';
    /** 概要文生放送アイコンテキスト */
    const DESC_LIVE_ICON_TEXT = 'LIVE';
    /** @type {Channel[]} */
    const channels = {};
    let trends = {};
    /** @type {Set<string>} */
    const trendSet = new Set();
    let descStr = '';
    let prevTrendsStr = '';

    const ticks = {
      refreshTrends: new Tick(10 * SEC),
      editTitle: new Tick(2 * SEC),
      editDate: new Tick(4 * SEC),
      editDesc: new Tick(1 * SEC),
    };

    const elementExists = {};
    waitForKeyElements('#container.ytd-video-primary-info-renderer > h1 > yt-formatted-string', () => {
      elementExists['editTitle'] = 1;
    });

    waitForKeyElements('#date > yt-formatted-string', () => {
      elementExists['editDesc'] = 1;
    });
    waitForKeyElements('#description.ytd-video-secondary-info-renderer > yt-formatted-string', () => {
      elementExists['editDate'] = 1;
    });

    const main = _ => {
      if (inWatchPage()) {
        if (ticks.refreshTrends.elapsed()) {
          refreshTrends();
          ticks.refreshTrends.update();
        }
        if (ticks.editTitle.elapsed() && elementExists['editTitle']) {
          editTitle();
          ticks.editTitle.update();
        }
        if (ticks.editDate.elapsed() && elementExists['editDate']) {
          editDate();
          ticks.editDate.update();
        }
        if (ticks.editDesc.elapsed() && elementExists['editDesc']) {
          editDesc();
          ticks.editDesc.update();
        }
      }
      setTimeout(() => {
        main();
      }, 500);
    };
    main();

    function refreshTrends() {
      GM.getValue(TREND_STORE_KEY).then(data => {
        if (data) {
          trends = JSON.parse(data);
          trendSet.clear();
        }
      });
    }

    function editTitle() {
      const container = document.querySelector('#container.ytd-video-primary-info-renderer');
      const titleNode = container.querySelector(':scope > h1 > yt-formatted-string');
      const keywordNode = container.querySelector(':scope > yt-formatted-string');
      new Promise(cb => {
        // 前回整備したタグを消す。新しく発生したタグはあるとしたら最後尾にある
        const prevLast = titleNode.querySelector(':scope > .miy-title-last');
        let doIt = false;
        if (prevLast) {
          if (!prevLast.isSameNode(titleNode.lastChild)) {
            doIt = true;
            [...titleNode.children].some(ch => {
              ch.remove();
              return [...ch.classList].some(cls => cls === 'miy-title-last');
            });
          }
        } else {
          doIt = true;
        }
        if (doIt) {
          makeSimpleTitleToSpan(titleNode);
          setParenLink(titleNode);
          hashtagnise(titleNode);
          // ページ遷移時に新しいタイトルが末尾に追加されるので見分けるためにマーキングする
          titleNode.lastElementChild.classList.add('miy-title-last');
          titleThumbnailLink(titleNode);
          downloadLink(titleNode);
        }
        cb();
      });
      new Promise(cb => {
        hashtagnise(keywordNode);
        keywordTrendingList(keywordNode);
        cb();
      });

      /**
       * ハッシュタグがないタイトルではtitleNodeに直にテキストが入っているので
       * ハッシュタグがある場合に合わせる
       * @param {Element} titleNode
       */
      function makeSimpleTitleToSpan(titleNode) {
        if (!titleNode.firstElementChild) {
          const spanText = titleNode.textContent;
          titleNode.textContent = '';
          titleNode.append(
            (_ => {
              const span = document.createElement('span');
              span.dir = 'auto';
              span.classList.add('style-scope', 'yt-formatted-string');
              span.append(document.createTextNode(spanText));
              return span;
            })()
          );
        }
      }

      /**
       * タイトルの【】内の文字列を検索リンクにする。/で区切られているとみなす。
       * @param {Element} titleNode
       */
      function setParenLink(titleNode) {
        // タイトルは文字列のspanとハッシュタグのaで構成されるのでspanのみ対象とする。
        titleNode.querySelectorAll('span').forEach(span => {
          const newTags = splitParenString(span.textContent).map(part => {
            if (part.inParen) {
              return (_ => {
                const aTag = document.createElement('a');
                aTag.dir = 'auto';
                aTag.classList.add('yt-simple-endpoint', 'style-scope', 'yt-formatted-string', 'miy-splitted-title');
                aTag.href = `results?search_query=${encodeURIComponent(part.part)}`;
                aTag.append(document.createTextNode(part.part));
                return aTag;
              })();
            } else {
              return (_ => {
                const span = document.createElement('span');
                span.dir = 'auto';
                span.classList.add('style-scope', 'yt-formatted-string', 'miy-splitted-title');
                span.append(document.createTextNode(part.part));
                return span;
              })();
            }
          });
          if (newTags.length > 0) {
            newTags.forEach(nt => titleNode.insertBefore(nt, span));
            span.remove();
          }
        });
      }

      /**
       * 文字列を【】の中と外に分割し{ part: 部分文字列, inParen: 【】内か否か }の配列にする。
       * 【】がない場合は空の配列を返す。【】内は/で区切って別要素とする。
       * @param {string} targetString
       * @returns "aaa【bbb/ccc】ccc【】" -> ["aaa【", "bbb", "/", "ccc", "】ccc【】" ]
       * @returns "aaaaa" -> ["aaaaa"]
       */
      function splitParenString(targetString) {
        const regex = /【.+?】/g;

        const tarAddrs = [0];
        let mat;
        while ((mat = regex.exec(targetString))) {
          tarAddrs.push(mat.index + 1, mat.index + mat[0].length - 1);
        }
        const parts = [];
        for (let adrIdx = 0; adrIdx < tarAddrs.length - 1; adrIdx++) {
          const tarFrom = tarAddrs[adrIdx];
          const tarTo = tarAddrs[adrIdx + 1];
          const inParen = adrIdx != 0 && targetString.slice(tarFrom - 1, tarFrom) === '【';
          const part = targetString.slice(tarFrom, tarTo);
          if (inParen) {
            part
              .split(TITLE_SPLITTER_IN_PAREN)
              .join('\t/\t')
              .split('\t')
              .forEach(p => parts.push({ part: p.trim(), inParen: p != '/' }));
          } else {
            parts.push({ part: part, inParen: inParen });
          }
        }
        parts.push({
          part: targetString.slice(tarAddrs[tarAddrs.length - 1]),
          inParen: false,
        });
        return parts;
      }

      /**
       *
       * @param {Element} titleNode
       */
      function titleThumbnailLink(titleNode) {
        titleNode.parentNode.querySelectorAll(':scope > .miy-thumbnailLink').forEach(m => m.remove());
        if (document.getElementById('scriptTag')) {
          const scriptTag = JSON.parse(document.getElementById('scriptTag').innerText);
          titleNode.parentNode.append(
            (_ => {
              const thumb = document.createElement('a');
              thumb.href = scriptTag.thumbnailUrl[0];
              thumb.target = '_blank';
              thumb.classList.add('myInsert', 'miy-thumbnailLink');
              thumb.append(
                (_ => {
                  const img = document.createElement('img');
                  img.src = thumb.href;
                  img.height = 20;
                  return img;
                })()
              );

              return thumb;
            })()
          );
        }
      }
      /**
       *
       * @param {Element} titleNode
       */
      function downloadLink(titleNode) {
        titleNode.parentNode.querySelectorAll(':scope > .miy-downloadLink').forEach(m => m.remove());
        titleNode.parentNode.append(
          (_ => {
            const link = document.createElement('a');
            link.href = "https://m.qrqrq.com/?bookmarklet="+encodeURIComponent(location.href.replace('www.youtube.com', 'www.flyoutube.com'));
            link.target = '_blank';
            link.classList.add('myInsert', 'miy-downloadLink');
            link.append(document.createTextNode('FL'));
            return link;
          })()
        );
      }

      /**
       *
       * @param {Element} keywordNode
       */
      function keywordTrendingList(keywordNode) {
        keywordNode.querySelectorAll('.miy-trendList').forEach(m => m.remove());
        keywordNode.append(
          (_ => {
            const trendListSpan = document.createElement('span');
            trendListSpan.append(document.createTextNode([...trendSet].join(' ')));
            trendListSpan.classList.add('miy-trendList');
            // trendListSpan.style = 'color: gold; margin-left: 4px;'; // 何故かクラスが効かないので
            return trendListSpan;
          })()
        );
      }
    }

    /**
     * 公開日時の編集
     */
    function editDate() {
      if (inWatchPage() && document.getElementById('scriptTag')) {
        const scriptTag = JSON.parse(document.getElementById('scriptTag').innerText);

        let dateStr = '';
        const dateStrTag = document.querySelector('#date > yt-formatted-string');
        if (scriptTag.publication) {
          const startDate = new Date(scriptTag.publication[0].startDate);
          const startDateStr = startDate.toLocaleString('ja').slice(2, -3);
          const nowDate = new Date();
          let liveState = '';
          if (scriptTag.publication[0].isLiveBroadcast) {
            liveState = 'streaming';
            const durStr = durationString(new Date(nowDate - startDate - 9 * 60 * 60 * 1000));
            dateStr = `${startDateStr} (${durStr})`;
          } else if (startDate - nowDate > 0) {
            liveState = 'scheduled';
            dateStr = `${startDateStr}`;
          } else {
            liveState = 'archived';
            const endDate = new Date(scriptTag.publication[0].endDate);
            const endDateStr = endDate.toLocaleString('ja').slice(-8, -3);
            const durStr = durationString(new Date(endDate - startDate - 9 * 60 * 60 * 1000));
            dateStr = `${startDateStr} - ${endDateStr} (${durStr})`;
          }

          dateStrTag.parentNode.querySelectorAll('.myInsert').forEach(m => m.remove());
          dateStrTag.innerText = dateStr;
          if (liveState) {
            dateStrTag.parentNode.append(
              (_ => {
                const liveSpan = document.createElement('span');
                liveSpan.classList.add('myInsert', `miy-liveState-${liveState}`);
                liveSpan.innerText = TITLE_LIVE_ICON_TEXT;
                return liveSpan;
              })()
            );
          }
        } else {
          // just a video
          const upDateStr = new Date(scriptTag.uploadDate).toLocaleDateString('ja').slice(2);
          dateStrTag.innerText = `${upDateStr}`;
        }
      }

      /**
       *
       * @param {number} dur 期間（2つのDateの差）
       * @returns 配信時間の文字列表現
       */
      function durationString(dur) {
        let durStr = '';
        if (dur.getHours() > 0) {
          durStr += dur.getHours() + 'h';
        }
        durStr += dur.getMinutes() + 'm';
        return durStr;
      }
    }

    /**
     * 概要文の編集
     */
    function editDesc() {
      if (inWatchPage()) {
        const description = document.querySelector(
          '#description.ytd-video-secondary-info-renderer > yt-formatted-string'
        );
        if (descStr === description.innerHTML && prevTrendsStr === JSON.stringify(trends, '', '')) {
          // nop
        } else {
          description.querySelectorAll(':scope .myInsert').forEach(m => m.remove());
          descVideoThumbnail(description);
          editShortenLink(description);
          descChannelLink(description);
          hashtagnise(description);
          descLessButton(description);

          descStr = description.innerHTML;
          prevTrendsStr = JSON.stringify(trends, '', '');
        }
      }

      /**
       * 概要文内の短縮URLリンクを展開して画像置き換え等を支援する。
       * @param {Element} description
       */
      function editShortenLink(description) {
        const userAgent =
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36';
        description.querySelectorAll(':scope > a[href^="/redirect"]').forEach(a => {
          const shURL = decodeURIComponent(splitUrlQueries(a.href).q || '');
          if (shURL.startsWith('https://t.co/')) {
            GM.xmlHttpRequest({
              method: 'GET',
              url: shURL,
              headers: { Accept: 'text/xml' },
              onload: function (data) {
                const newURL = /URL=(.+?)"/g.exec(data.responseXML.querySelector('noscript').innerHTML)[1];
                a.href = newURL;
                a.text = newURL;
              },
            });
          } else if (shURL.startsWith('http://ur2.link/') || shURL.startsWith('https://bit.ly/')) {
            GM.xmlHttpRequest({
              method: 'GET',
              url: shURL,
              headers: { Accept: 'text/xml', 'user-agent': userAgent },
              onload: function (data) {
                a.href = data.finalUrl;
                a.text = data.finalUrl;
              },
            });
          }
        });
      }

      /**
       * 概要文内の動画リンクテキストをサムネイル画像に置き換える。
       * @param {Element} description
       */
      function descVideoThumbnail(description) {
        [...description.querySelectorAll(':scope > a[href^="/watch"]')]
          .filter(a => ![...a.classList].includes('myInsert'))
          .forEach(a => {
            const search = splitUrlQueries(a.search);
            const isSelfVideo = search.t && splitUrlQueries(document.location.search).v === search.v;
            if (!isSelfVideo) {
              a.text = '';
              a.append(
                (_ => {
                  const iTag = document.createElement('img');
                  iTag.src = `https://i.ytimg.com/vi/${search.v}/mqdefault.jpg`;
                  iTag.height = 94;
                  iTag.classList.add('myInsert');
                  return iTag;
                })()
              );
            }
          });
      }

      /**
       * 概要文内のチャンネルリンクテキストをアイコン画像に変更する。
       * またチャンネルページ内のTwitterなどのリンクをアイコンとともに追加する。
       * @param {Element} description
       */
      function descChannelLink(description) {
        [...description.querySelectorAll(':scope > a')]
          .map(a => {
            // https://www.youtube.com/channel/XXXXXXXXXXXXXXXXXXXXXXXX
            // https://www.youtube.com/c/XXXXXXXXXXXXXXXXXXXXXXXX
            // https://www.youtube.com/user/YYYYY
            if (a.href.match(/youtube\.com\/(c|channel|user)\//g)) {
              return a;
            }
            return null;
          })
          .filter(a => a)
          .forEach(a => {
            const chUrl = a.href;
            if (channels[chUrl]) {
              channels[chUrl].customiseHyperlink(a);
            } else {
              $(function () {
                $.ajax({
                  url: chUrl,
                  cache: false,
                  datatype: 'html',
                }).done(data => {
                  const doc = new DOMParser().parseFromString(data, 'text/html');
                  try {
                    const ytInitialData = JSON.parse(
                      [...doc.scripts]
                        .filter(s => s.innerText.trim().startsWith('window["ytInitialData"]'))[0]
                        .innerHTML.split('\n')[1]
                        .trim()
                        .slice(26, -1)
                    );
                    channels[chUrl] = new Channel(ytInitialData.header.c4TabbedHeaderRenderer.avatar.thumbnails[0].url);
                    const headerLinks =
                      ytInitialData.header.c4TabbedHeaderRenderer.headerLinks.channelHeaderLinksRenderer;
                    [...(headerLinks.primaryLinks || []), ...(headerLinks.secondaryLinks || [])]
                      .filter(l => l.navigationEndpoint.urlEndpoint.url)
                      .map(
                        l =>
                          new ChannelLink(
                            l.navigationEndpoint.urlEndpoint.url,
                            l.icon.thumbnails[0].url,
                            l.title.simpleText
                          )
                      )
                      .forEach(o => channels[chUrl].links.push(o));
                    const videoRenderer = queryObjectPath(
                      ytInitialData,
                      'contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.' +
                        'contents[0].itemSectionRenderer.contents[0].channelFeaturedContentRenderer.items[0].videoRenderer'
                    );
                    if (videoRenderer) {
                      const isLiveNow =
                        'BADGE_STYLE_TYPE_LIVE_NOW' ===
                        queryObjectPath(videoRenderer, 'badges[0].metadataBadgeRenderer.style');
                      if (isLiveNow) {
                        channels[chUrl].liveUrl = queryObjectPath(
                          videoRenderer,
                          'navigationEndpoint.commandMetadata.webCommandMetadata.url'
                        );
                      }
                    }

                    channels[chUrl].customiseHyperlink(a);
                  } catch (error) {
                    console.error(`failed parse ${chUrl}`);
                    console.error(error);
                  }
                });
              });
            }
          });
      }

      /**
       * 「一部を表示」ボタンを概要文の手前にも表示する。
       * @param {Element} description
       */
      function descLessButton(description) {
        description.insertBefore(
          (_ => {
            const lessButton = document.createElement('span');
            lessButton.dir = 'auto';
            lessButton.classList.add(
              'myInsert',
              'less-button',
              'style-scope',
              'ytd-video-secondary-info-renderer',
              'miy-lessButton'
            );
            lessButton.innerText = LESS_BUTTON_TEXT;
            lessButton.onclick = _ => document.querySelector('#less').click();
            return lessButton;
          })(),
          description.firstChild
        );
      }
    }

    /**
     * ハイパーリンクがハッシュタグだった場合に、ツイッターのハッシュタグ検索へのリンクを追加する
     * @param {NodeListOf<HTMLAnchorElement>|HTMLAnchorElement} containerElement ハイパーリンクの配列
     */
    function hashtagnise(containerElement) {
      containerElement.querySelectorAll(':scope .miy-hashtag').forEach(a => a.remove());
      [...containerElement.querySelectorAll(':scope a')] // 48 characters
        .filter(a => a.href.match(/\/results\?search_query=(%23|%EF%BC%83).+/))
        .forEach(a => {
          a.textContent = a.textContent.replace('%EF%BC%83', '%23');
          a.href = a.href.replace('%EF%BC%83', '%23');
          a.parentNode.insertBefore(
            (_ => {
              const twATag = document.createElement('a');
              twATag.href = 'https://twitter.com/hashtag/' + a.href.slice(48);
              twATag.target = '_blank';
              twATag.classList.add('miy-hashtag');
              // twATag.style = 'color: gold;text-decoration: none'; // クラスが効かないので

              twATag.append(
                (_ => {
                  const twITag = document.createElement('img');
                  twITag.src =
                    'https://s2.googleusercontent.com/s2/favicons?feature=youtube_channel&domain_url=https%3A%2F%2Ftwitter.com';
                  return twITag;
                })()
              );
              if (trends[a.textContent]) {
                twATag.append(
                  (_ => {
                    const rankSpan = document.createElement('span');
                    rankSpan.append(document.createTextNode(`:国内${trends[a.textContent]}位`));
                    rankSpan.classList.add('miy-trend');
                    return rankSpan;
                  })()
                );
                trendSet.add(`${a.textContent}:国内${trends[a.textContent]}位`);
              }
              return twATag;
            })(),
            a.nextSibling
          );
        });
    }

    /**
     *
     * @param {string} queryStr URLまたはそのクエリ文字列部分
     * @returns クエリのキーと値からなる連想配列
     */
    function splitUrlQueries(queryStr) {
      const queries = {};

      // クエリがない場合は空のオブジェクトを返す
      if (!queryStr) {
        return queries;
      }
      let q = queryStr;
      if (queryStr.indexOf('?') > -1) {
        q = queryStr.split('?', 2)[1];
      }
      // クエリ文字列を & で分割して処理
      q.split('&').forEach(function (kv) {
        // = で分割してkey,valueをオブジェクトに格納
        const queryArr = kv.split('=');
        queries[queryArr[0]] = queryArr[1];
      });

      return queries;
    }

    /**
     *
     * @param {Object} obj オブジェクト
     * @param {string} path オブジェクトのプロパティにアクセスするパス（一連の".プロパティ名" や ["プロパティ名"] 、 [インデックス]）の文字列
     * @returns パスが指すオブジェクト、パスが不正であれば undefined
     */
    function queryObjectPath(obj, path) {
      let trav = obj;
      try {
        path
          .replace(/\["?(\w+?)"?\]/g, '.$1') // '[n]' -> '.n' '["s"]' -> '.s'
          .split('.')
          .forEach(p => (trav = trav[p]));
        return trav;
      } catch (error) {
        return null;
      }
    }

    function inWatchPage() {
      return location.host === 'www.youtube.com' && location.pathname === '/watch';
    }
  };

  const twitterBlock = function () {
    const TREND_RETRY_TICK_MS = 1 * SEC;
    const REND_UPDATE_TTICK_MS = 3 * MIN;
    const main = () => {
      const divs = document.querySelectorAll(
        '#react-root > div > div > div.css-1dbjc4n.r-18u37iz.r-13qz1uu.r-417010 > main > div > div > div > ' +
          'div.css-1dbjc4n.r-yfoy6g.r-18bvks7.r-1ljd8xs.r-13l2t4g.r-1phboty.r-1jgb5lz.r-11wrixw.r-61z16t.r-1ye8kvj.r-13qz1uu.r-184en5c > ' +
          'div > div.css-1dbjc4n.r-1jgb5lz.r-1ye8kvj.r-13qz1uu > div > div > section > div > div > div > div > div > div > div'
      );
      console.log(`divs ${divs.length}`);
      doIt(divs);
      if (divs.length < 29) {
        setTimeout(function () {
          main();
        }, TREND_RETRY_TICK_MS);
      } else {
        console.log('done');
      }
      setTimeout(function () {
        window.location.reload(true);
      }, REND_UPDATE_TTICK_MS);
    };
    function doIt(divs) {
      const trends = {};
      let len = 0;
      [...divs].slice(1).forEach(d => {
        trends[d.querySelector(':scope > div:nth-child(2) > span').textContent] = d.querySelector(
          ':scope > div:nth-child(1) > div > span'
        ).textContent;
        len++;
      });
      console.log(`trends stored. ${len}`);
      trends['#ぺこらいぶ'] = 105;
      GM.setValue(TREND_STORE_KEY, JSON.stringify(trends, '', ''));
    }
    main();
  };

  if (location.host === 'www.youtube.com') {
    youtubeBlock();
  } else if (location.href === 'https://twitter.com/explore/tabs/trending') {
    twitterBlock();
  }
};
decorateYoutubeDesc();

document.execCopy = function (string) {
  var temp = document.createElement('textarea');

  temp.value = string;
  temp.selectionStart = 0;
  temp.selectionEnd = temp.value.length;

  var s = temp.style;
  s.position = 'fixed';
  s.left = '-100%';

  document.body.appendChild(temp);
  temp.focus();
  var result = document.execCommand('copy');
  temp.blur();
  document.body.removeChild(temp);
  // true なら実行できている falseなら失敗か対応していないか
  return result;
};

document.execCopyJson = function (obj) {
  document.execCopy(JSON.stringify(obj, '\n', '    '));
};
