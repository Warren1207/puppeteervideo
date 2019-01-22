'use strict';
const puppeteer = require('puppeteer');
const Q = require('q');
const jsonfile = require('jsonfile')
//const EmailSend = require('./EmailSend');
(async () => {
    const browser = await puppeteer.launch({headless: false,timeout: 5000,});
    const baseUrl = "http://www.kpd126.com";
    const page = await browser.newPage();
    let resultJsonArray = [];
    const pageGo = async function(url){
        const deferred = Q.defer();
        console.log(url);
        try{
            await page.goto(url);
            deferred.resolve(page);
        }catch (e) {
            console.log(e.message);
            pageGo(url)
        }
        return deferred.promise;
    };
    const pageDetailGo = async function(url){
        const deferred = Q.defer();
        console.log(url);
        const pageD = await browser.newPage();
        try{
            await pageD.goto(url);
            deferred.resolve(pageD);
        }catch (e) {
            await pageD.close();
            pageGo(url)
        }
        return deferred.promise;
    };
    const readPage = function(){
        const readHtml = async function(page){
            const videoList = await page.$$eval('.panel-list li', elements => {
                let videos = [];
                for(let i=0;i<elements.length;i++){
                    const div = elements[i];
                    const href = div.querySelector('a').getAttribute('href');
                    const title = div.querySelector('a').getAttribute('title');
                    let imgsrc = div.querySelector('img').getAttribute('src');
                    if(imgsrc.indexOf("http")<0){
                        imgsrc = "http://www.kpd126.com"+imgsrc;
                    }
                    const videoDetail = {
                        href,
                        title,
                        imgsrc
                    };
                    if(href.indexOf("http")<0){
                        videos.push(videoDetail)
                    }

                }
                return videos;
            });
            let count = 0;
            const readDetailHtml =async function(){
                if(count< videoList.length){
                    console.log(count);
                  const videoDetail = videoList[count];
                  pageDetailGo("http://www.kpd126.com"+videoDetail.href).then(async function(pageDetail){
                      const iframeSrc = await pageDetail.$eval('iframe', iframe => {
                          return iframe.getAttribute('src');
                      });
                      await pageDetail.close();
                      pageDetailGo("http://www.kpd126.com"+iframeSrc).then(async function(pageVideo){
                          const m3u8Src = await pageVideo.$eval('video', video => {
                              return video.getAttribute('src');
                          });
                          await pageVideo.close();
                          videoList[count].m3u8Src = m3u8Src;
                          count ++ ;
                          readDetailHtml();
                      });
                  });
                }else{
                    resultJsonArray = resultJsonArray.concat(videoList);
                    jsonfile.writeFile('./m3u8.json', resultJsonArray, function (err) {
                        if (err) console.error(err)
                    });
                    const paginations = await page.$$('.pagination li');
                    if(paginations.length<=5){
                        console.log("所有分页读取完毕");
                        browser.close();
                    }else{
                        const link = await page.$eval('.pagination li a[title="下一页"]', adom => {
                            return adom.getAttribute('href');
                        });

                        pageGo("http://www.kpd126.com"+link).then(readHtml);
                    }
                }
            };
            readDetailHtml();
        };
        if(page.url() == "about:blank"){
            pageGo("http://www.kpd126.com"+'/whmm/index.html').then(readHtml);
        }
    }
    readPage();
})();