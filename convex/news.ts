"use node";

import { action } from "./_generated/server";

const APIFY_ACTOR_ID = "muhammetakkurtt~cointelegraph-news-scraper";

export const getCryptoNews = action({
  args: {},
  handler: async () => {
    const apifyToken = process.env.APIFY_API_TOKEN;
    if (!apifyToken) {
      console.log("No APIFY_API_TOKEN, using RSS fallback");
      return await fetchNewsFromRSS();
    }
    try {
      const startRes = await fetch(
        `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs?token=${apifyToken}&timeout=60&memory=256`,
        { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({language:"en",articleCount:10}) }
      );
      if (!startRes.ok) return await fetchNewsFromRSS();
      const startData = await startRes.json();
      const runId = startData?.data?.id;
      let datasetId = startData?.data?.defaultDatasetId||"";
      if (!runId) return await fetchNewsFromRSS();
      let status = "RUNNING";
      for (let i=0;i<11;i++) {
        await new Promise(r=>setTimeout(r,5000));
        const p = await (await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`)).json();
        status = p?.data?.status||"RUNNING";
        datasetId = p?.data?.defaultDatasetId||datasetId;
        if (status==="SUCCEEDED") break;
        if (["FAILED","ABORTED","TIMED-OUT"].includes(status)) break;
      }
      if (status!=="SUCCEEDED"||!datasetId) return await fetchNewsFromRSS();
      const dataRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}&limit=10`);
      if (!dataRes.ok) return await fetchNewsFromRSS();
      const items: any[] = await dataRes.json();
      if (!items?.length) return await fetchNewsFromRSS();
      const all = items.slice(0,10).map((item:any,i:number)=>({
        id:String(item.id||i),
        title:item.postTranslate?.title||item.title||"—",
        url:item.post_url||item.url||"#",
        source:"Cointelegraph",
        published_at:item.published||new Date().toISOString(),
        currencies:extractTickers(item.postTranslate?.title||item.title||""),
        sentiment:guessSentiment(item.postTranslate?.title||"",item.postTranslate?.leadText||""),
        votes:{positive:0,negative:0,important:0},
        summary:item.postTranslate?.leadText||"",
      }));
      return {success:true,hot:all.slice(0,6),rising:all.slice(6,10),source:"apify",fetchedAt:Date.now()};
    } catch(e) {
      return await fetchNewsFromRSS();
    }
  },
});

async function fetchNewsFromRSS() {
  const feeds = [
    {url:"https://www.coindesk.com/arc/outboundfeeds/rss/",source:"CoinDesk"},
    {url:"https://cointelegraph.com/rss",source:"Cointelegraph"},
    {url:"https://cryptonews.com/news/feed/",source:"CryptoNews"},
    {url:"https://decrypt.co/feed",source:"Decrypt"},
  ];
  let allItems: any[] = [];
  for (const feed of feeds) {
    if (allItems.length>=10) break;
    try {
      const res = await fetch(feed.url,{headers:{"User-Agent":"Mozilla/5.0 (compatible; NoelClaw/1.0)"},signal:AbortSignal.timeout(8000)});
      if (!res.ok) continue;
      const xml = await res.text();
      const matches = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
      const parsed = matches.slice(0,6).map((m,i)=>{
        const item = m[1];
        const title=(item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]||"").trim();
        const link=(item.match(/<link>(.*?)<\/link>/)?.[1]||item.match(/<guid[^>]*>(.*?)<\/guid>/)?.[1]||"#").trim();
        const pubDate=item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]||new Date().toISOString();
        const desc=(item.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1]||"").replace(/<[^>]+>/g,"").slice(0,200).trim();
        if (!title) return null;
        return {id:link||String(allItems.length+i),title,url:link,source:feed.source,published_at:pubDate,currencies:extractTickers(title),sentiment:guessSentiment(title,desc),votes:{positive:0,negative:0,important:0},summary:desc,domain:feed.source.toLowerCase()};
      }).filter(Boolean);
      allItems=[...allItems,...parsed];
    } catch(e){ console.log(`RSS failed ${feed.source}`,e); }
  }
  if (!allItems.length) return {success:false,hot:[],rising:[],source:"none",fetchedAt:Date.now()};
  return {success:true,hot:allItems.slice(0,6),rising:allItems.slice(6,10),source:"rss",fetchedAt:Date.now()};
}

const TICKER_RE=/\b(BTC|ETH|SOL|XRP|BNB|DOGE|ADA|AVAX|MATIC|DOT|LINK|UNI|SHIB|ATOM|ARB|OP|BASE|BRETT|DEGEN)\b/g;
function extractTickers(text:string):string[]{return[...new Set((text.toUpperCase().match(TICKER_RE)||[]))].slice(0,4);}
const BULL=["surge","soar","rally","gain","rise","bull","pump","ath","high","record","boost","launch","approve","growth","jump"];
const BEAR=["drop","fall","crash","bear","dump","low","down","fear","hack","ban","risk","loss","decline","plunge","collapse","warn"];
function guessSentiment(title:string,summary:string):"bullish"|"bearish"|"neutral"{
  const txt=(title+" "+summary).toLowerCase();
  const b=BULL.filter(w=>txt.includes(w)).length;
  const r=BEAR.filter(w=>txt.includes(w)).length;
  return b>r?"bullish":r>b?"bearish":"neutral";
}

export const getMessariMetrics = action({
  args:{},
  handler:async()=>{
    const key=process.env.MESSARI_API_KEY;
    if(!key) return {success:false,global:null,topAssets:[],error:"No MESSARI_API_KEY"};
    try{
      const headers={"x-messari-api-key":key};
      const [gr,ar]=await Promise.all([
        fetch("https://data.messari.io/api/v1/global/metrics",{headers}),
        fetch("https://data.messari.io/api/v2/assets?fields=id,slug,symbol,name,metrics/market_data/price_usd,metrics/market_data/percent_change_usd_last_24_hours,metrics/market_data/volume_last_24_hours&limit=15",{headers}),
      ]);
      let global=null,topAssets:any[]=[];
      if(gr.ok){const d=await gr.json();const g=d.data;global={totalMarketCapUsd:g?.total_market_cap_usd??null,btcDominance:g?.btc_dominance_percent??null,ethDominance:g?.eth_dominance_percent??null,totalVolume24h:g?.total_volume_last_24_hours??null};}
      if(ar.ok){const d=await ar.json();topAssets=(d.data||[]).slice(0,10).map((a:any)=>({symbol:a.symbol,name:a.name,priceUsd:a.metrics?.market_data?.price_usd??null,change24h:a.metrics?.market_data?.percent_change_usd_last_24_hours??null,volume24h:a.metrics?.market_data?.volume_last_24_hours??null}));}
      return {success:true,global,topAssets,fetchedAt:Date.now()};
    }catch(e){return {success:false,global:null,topAssets:[],error:String(e)};}
  },
});