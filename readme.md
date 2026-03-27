# Taiwan Satellite Tracker 3D — 專案簡介

> 一個部署在 Vercel 上的 Node.js 後端 API，結合 3D 地球儀前端，即時追蹤繞地衛星過台灣的時間與軌跡。

---

## Thread 1／專案是什麼？

這個專案分兩層：

- **後端 API**（本 repo）：Node.js + Express，部署於 Vercel Serverless
- **前端**：純 HTML + globe.gl，渲染 3D 地球 + 衛星標記

功能：
- 即時取得任意衛星目前位置（經緯度、高度、速度）
- 預測衛星未來 24–72 小時過台灣的時間與仰角
- 繪製衛星軌道路徑（90 分鐘軌道）
- 每日過境摘要（今天 / 明天各國衛星過台次數）
- 雜湊產生器（MD5 / SHA-256 等，原始功能）

---

## Thread 2／資料來源

衛星軌道資料來自 **CelesTrak**（NASA 認可的公開 TLE 資料庫）：

```
https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle
https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=tle   ← ISS
https://celestrak.org/NORAD/elements/gp.php?NAME=YAOGAN&FORMAT=tle   ← 遥感系列
```

**TLE（Two-Line Element）** 是描述衛星軌道的標準格式，每筆資料包含 3 行：

```
ISS (ZARYA)
1 25544U 98067A   24001.00000000  .00000000  00000-0  00000-0 0  9999
2 25544  51.6400 000.0000 0000000   0.0000   0.0000 15.50000000000000
```

後端收到後用 **satellite.js** 做軌道傳播計算（SGP4 演算法），換算成經緯度與高度。

---

## Thread 3／架構圖

```
前端 (docs/index.html)
    │  fetch
    ▼
後端 API (Vercel Serverless)
    │
    ├── POST /hash              ← Node.js crypto 模組
    │
    └── /satellites/*
          │  cache (in-memory, TTL 2h)
          ▼
       CelesTrak API
       (TLE 原始資料)
          │
          ▼
       satellite.js (SGP4)
       (軌道傳播計算)
```

資料流：
1. 前端發 request 給後端
2. 後端先查 in-memory cache（TTL 2 小時）
3. Cache miss → fetch CelesTrak → 解析 TLE → 存 cache
4. 用 SGP4 演算法計算當下位置 / 預測過境

---

## Thread 4／API 端點一覽

| Method | Path | 說明 |
|--------|------|------|
| `POST` | `/hash` | 產生雜湊值，body: `{ text, algorithm }` |
| `GET` | `/satellites?group=starlink` | 列出該群組衛星清單 |
| `GET` | `/satellites?series=YAOGAN` | 依衛星系列搜尋 |
| `GET` | `/satellites/:id/position` | 即時位置（經緯度、高度、速度） |
| `GET` | `/satellites/:id/passes?hours=24` | 預測過台灣時間（含仰角、方位角） |
| `GET` | `/satellites/:id/orbit?duration=90` | 90 分鐘軌道路徑點 |
| `GET` | `/satellites/pass-summary` | 今明兩日各國過境統計（有 3h cache） |
| `GET` | `/api/cron/update-tle` | Vercel Cron 觸發，每天 04:00 UTC 預熱 cache |

支援的衛星群組：`stations`、`weather`、`starlink`、`gps-ops`、`galileo`、`active`

---

## Thread 5／如何建構 & 部署

**本地開發：**

```bash
git clone https://github.com/s0914712/hash-generator-backend
cd hash-generator-backend
npm install

# 解開 index.js 最後的 app.listen 區塊後：
node index.js
# → http://localhost:3000
```

**部署到 Vercel：**

```bash
npm install -g vercel
vercel --prod
```

`vercel.json` 已設定：
- 所有路由導向 `index.js`
- Cron job 每天 `0 4 * * *`（UTC 04:00）自動刷新 TLE cache

**前端：** 靜態 HTML 放在 `docs/`，透過 GitHub Pages 或直接開啟即可使用。

---

## Thread 6／技術選型

| 技術 | 用途 |
|------|------|
| Node.js + Express | 後端框架 |
| satellite.js | SGP4 軌道傳播（TLE → 經緯度） |
| globe.gl + Three.js | 3D 地球儀渲染 |
| Vercel Serverless | 免費 hosting + Cron |
| CelesTrak | 公開 TLE 資料來源 |
| Node.js crypto | SHA-256 / MD5 雜湊 |

In-memory cache 設計：
- TLE 資料 TTL **2 小時**（衛星軌道幾天才變一次，不需要太頻繁）
- Pass summary TTL **3 小時**（計算量大，約 150 顆衛星各算 48 小時）
- Vercel Cron 每日預熱常用群組，避免冷啟動延遲

---

> Live Demo: https://hash-generator-backend-ten.vercel.app
