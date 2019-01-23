'use strict';
const puppeteer = require('puppeteer');
const Q = require('q');
const jsonfile = require('jsonfile');
//const EmailSend = require('./EmailSend');
(async () => {
    let browser = await puppeteer.launch({headless: true});
    const baseUrl = "http://www.kpd126.com";
    let page = await browser.newPage();
    let resultJsonArray = [];
    const readJson = async function(){
        const deferred = Q.defer();
        await jsonfile.readFile('./m3u8.json').then(res => {
            deferred.resolve(res);
        });
        return deferred.promise;
    };
    await readJson().then(function(res){
        resultJsonArray = res;
    });
    const pageGo = async function(url){
        const deferred = Q.defer();
        console.log("page>>>>>>>"+url);
        let openPage = false;
        const pageTo = async function(){
            try{
                await page.goto(url);
                openPage = true;
            }catch (e) {
                pageTo(url)
            }
        };
        await pageTo();
        const setInt = setInterval(function(){
            if(openPage == true){
                clearInterval(setInt);
                deferred.resolve(page);
            }
        },200);
        return deferred.promise;
    };
    const pageDetailGo = async function(url){
        const deferred = Q.defer();
        console.log("pageDetail>>>>>>>"+url);
        const pageD = await browser.newPage();
        let openPage = false;
        const pageTo = async function(){
            try{
                await pageD.goto(url);
                await pageD.waitFor(3000);
                openPage = true;
            }catch (e) {
                pageTo(url)
            }
        };
        await pageTo();
        const setInt = setInterval(function(){
            if(openPage == true){
                clearInterval(setInt);
                deferred.resolve(pageD);
            }
        },200);
        // try{
        //     await pageD.goto(url);
        //     await pageD.waitFor(3000);
        //     deferred.resolve(pageD);
        // }catch (e) {
        //     console.log(e.message);
        //     await pageD.close();
        //     pageDetailGo(url);
        // }
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
                    console.log(count+ ">>>>>>>>>>>>>>>>>>>>>" + videoList.length);
                  const videoDetail = videoList[count];
                  pageDetailGo("http://www.kpd126.com"+videoDetail.href).then(async function(pageDetail){
                      const iframeSrc = await pageDetail.$eval('iframe', iframe => {
                          return iframe.getAttribute('src');
                      });
                      await pageDetail.close();
                      pageDetailGo("http://www.kpd126.com"+iframeSrc).then(async function(pageVideo){
                          let videoPd = null;
                          try{
                              videoPd = await pageVideo.$('video');
                          }catch (e) {
                              videoPd = null;
                          }
                          let m3u8Src = null;
                          if(videoPd){
                              m3u8Src = await pageVideo.$eval('video', video => {
                                  console.log(video);
                                  if(!video){
                                      return null;
                                  }
                                  return video.getAttribute('src');
                              });
                          }else{
                              console.log("会员页面："+pageVideo.url())
                          }
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
                        // await browser.close();
                        // browser = await puppeteer.launch({headless: true});
                        // page = await browser.newPage();
                        pageGo("http://www.kpd126.com"+link).then(readHtml);
                    }
                }
            };
            readDetailHtml();
        };
        if(page.url() == "about:blank"){
            pageGo("http://www.kpd126.com"+'/whmm/index_49.html').then(readHtml);
        }
    }
    readPage();
})();