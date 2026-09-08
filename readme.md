# Taiwan Satellite Tracker 3D

> 台灣衛星追蹤器 — 即時 3D 衛星追蹤、軌道預測與過境分析平台

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)](https://hash-generator-backend-ten.vercel.app)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js)](https://expressjs.com/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

## Demo

- **Dashboard** — 完整功能的衛星追蹤儀表板：[index.html](https://s0914712.github.io/hash-generator-backend/index.html)
- **Showcase** — 指揮中心風格的視覺化介面：[showcase.html](https://s0914712.github.io/hash-generator-backend/showcase.html)
- **China Passes** — 中國衛星通過台灣的逐時時間表：[china.html](https://s0914712.github.io/hash-generator-backend/china.html)

## Features

### 3D 衛星視覺化
- 基於 Globe.gl 的互動式 3D 地球儀
- 即時衛星位置標記與軌道路徑渲染
- 台灣地面站標記與脈衝波環
- 自動旋轉、縮放、拖曳等互動操作

### 即時衛星追蹤
- SGP4/SDP4 軌道傳播模型（satellite.js）
- 每 5 秒自動更新衛星位置
- 支援 6 大衛星群組：Space Stations / Weather / Starlink / GPS / Galileo / All Active
- 支援 26+ 衛星系列，涵蓋中國、日本、美國、印度、俄羅斯等國

### 台灣過境預測
- 預測衛星未來 24-72 小時經過台灣的時間窗口
- 顯示仰角、方位角、持續時間等詳細資訊
- 每日過境摘要，依國家分類統計

### 中國衛星通過時間表
- 今日與明日每一次通過的**實際起訖時間**（台北時間 UTC+8），例如 `08:12–08:24`，而非只有次數
- 以 `0800-0900` 為單位的每小時分組與長條圖，可一眼看出密集時段
- 粗掃 + 二分法收斂，起訖時間誤差在數秒內
- 標示進行中／下一次通過並即時倒數；同步軌道衛星另列為「持續位於視野內」

### 雙前端介面
| Dashboard (`index.html`) | Showcase (`showcase.html`) |
|---|---|
| 傳統儀表板佈局 | 軍事指揮中心 HUD 風格 |
| 右側摺疊式側邊欄 | 四角 HUD 面板 |
| 高度範圍篩選器 | 底部衛星晶片選擇列 |
| 搜尋功能 | 即時 UTC 時鐘 |
| 深藍色主題 | 暗黑 + 青色/綠色主題 |

另有 **China Passes (`china.html`)**：專注於中國衛星通過台灣時間表的單頁介面，提供日期切換、仰角門檻、系列篩選與名稱搜尋。

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express |
| Orbital Mechanics | [satellite.js](https://github.com/shashwatak/satellite-js) (SGP4) |
| 3D Visualization | [Globe.gl](https://globe.gl/) (Three.js) |
| TLE Data Source | [CelesTrak](https://celestrak.org/) |
| Deployment | Vercel (Serverless) |
| Frontend | Vanilla HTML/CSS/JS |

## Project Structure

```
├── index.js                    # Express 主入口
├── vercel.json                 # Vercel 部署設定 + Cron Job
├── package.json
├── satellite/
│   ├── constants.js            # 觀測站座標、衛星群組/系列定義
│   ├── tleCache.js             # TLE 資料快取（2 小時 TTL）
│   ├── propagator.js           # 軌道傳播計算（位置、軌道、過境、通過時間窗）
│   ├── chinaPasses.js          # 中國衛星通過台灣的每日時間表計算
│   └── router.js               # API 路由
└── docs/
    ├── index.html              # Dashboard 前端
    ├── showcase.html           # Showcase 前端
    └── china.html              # 中國衛星通過時間表前端
```

## API Reference

### General

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | 健康檢查 |
| `POST` | `/hash` | 雜湊產生器（body: `{ text, algorithm }`） |

### Satellites

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/satellites` | 取得衛星列表 |
| `GET` | `/satellites/series` | 取得可用衛星系列 |
| `GET` | `/satellites/pass-summary` | 每日過境摘要（台灣） |
| `GET` | `/satellites/china-passes` | 中國衛星今明兩日通過台灣的時間窗口 |
| `GET` | `/satellites/:id/position` | 衛星即時位置 |
| `GET` | `/satellites/:id/passes` | 過境預測（台灣） |
| `GET` | `/satellites/:id/orbit` | 軌道路徑 |

### Query Parameters

**`GET /satellites`**
| Param | Type | Default | Description |
|---|---|---|---|
| `group` | string | `stations` | 衛星群組（stations, weather, starlink, gps-ops, galileo, active） |
| `series` | string | — | 衛星系列名稱（覆蓋 group） |
| `search` | string | — | 依名稱搜尋（不分大小寫） |

**`GET /satellites/:id/position`**
| Param | Type | Default | Description |
|---|---|---|---|
| `at` | ISO string | now | 指定時間點 |

**`GET /satellites/:id/passes`**
| Param | Type | Default | Description |
|---|---|---|---|
| `hours` | number | `24` | 預測時間窗口（1-72 小時） |
| `minElevation` | number | `10` | 最低仰角（度） |

**`GET /satellites/china-passes`**
| Param | Type | Default | Description |
|---|---|---|---|
| `series` | string | — | 限定單一中國衛星系列（如 `YAOGAN`），省略則涵蓋全部 18 個系列 |
| `minElevation` | number | `10` | 最低仰角（0-80 度）；通過定義為仰角高於此值的連續時段 |
| `limit` | number | `220` | 納入計算的衛星數上限（最大 400），跨系列輪流取樣 |

**`GET /satellites/:id/orbit`**
| Param | Type | Default | Description |
|---|---|---|---|
| `duration` | number | `90` | 軌道時長（分鐘，最大 360） |
| `step` | number | `1` | 步長（分鐘，最小 1） |

### Response Examples

<details>
<summary>GET /satellites?group=stations</summary>

```json
{
  "group": "stations",
  "count": 12,
  "satellites": [
    {
      "name": "ISS (ZARYA)",
      "noradId": "25544",
      "intlDesignator": "98067A",
      "epochYear": 2025,
      "epochDay": 120.5
    }
  ]
}
```
</details>

<details>
<summary>GET /satellites/25544/position</summary>

```json
{
  "noradId": "25544",
  "name": "ISS (ZARYA)",
  "position": {
    "latitude": 23.8421,
    "longitude": 120.9534,
    "altitude": 420.3,
    "velocity": 7.66,
    "timestamp": "2025-03-27T12:00:00.000Z"
  }
}
```
</details>

<details>
<summary>GET /satellites/25544/passes?hours=24</summary>

```json
{
  "noradId": "25544",
  "name": "ISS (ZARYA)",
  "observer": { "latitude": 23.5, "longitude": 121, "location": "Taiwan" },
  "passes": [
    {
      "startTime": "2025-03-27T18:30:00.000Z",
      "startAzimuth": 220,
      "maxElevation": 65,
      "maxElevationTime": "2025-03-27T18:34:00.000Z",
      "endTime": "2025-03-27T18:38:00.000Z",
      "endAzimuth": 40,
      "durationSeconds": 480
    }
  ]
}
```
</details>

<details>
<summary>GET /satellites/china-passes</summary>

```json
{
  "observer": { "latitude": 23.5, "longitude": 121, "location": "Taiwan" },
  "timezone": { "name": "Asia/Taipei", "label": "UTC+8", "utcOffsetMinutes": 480 },
  "minElevation": 10,
  "seriesLabels": { "YAOGAN": "遥感 (Remote Sensing)" },
  "source": {
    "country": "China",
    "series": ["YAOGAN", "GAOFEN", "JILIN", "..."],
    "failedSeries": [],
    "satellitesAvailable": 612,
    "satellitesTracked": 220,
    "truncated": true
  },
  "days": [
    {
      "label": "today",
      "date": "2025-03-27",
      "passCount": 742,
      "satelliteCount": 168,
      "coverageMinutes": 5036.2,
      "busiestHour": { "hour": 8, "label": "0800-0900", "passes": 43 },
      "hours": [
        { "hour": 8, "label": "0800-0900", "passes": 43, "coverageMinutes": 299.4,
          "satelliteCount": 41, "satellites": ["YAOGAN-33 (B)", "GAOFEN-11"] }
      ],
      "passes": [
        {
          "name": "YAOGAN-33 (B)",
          "noradId": "48918",
          "series": "YAOGAN",
          "start": "2025-03-27T00:12:31.000Z",
          "end": "2025-03-27T00:24:07.000Z",
          "startLocal": "08:12",
          "endLocal": "08:24",
          "window": "0812-0824",
          "hourWindow": "0800-0900",
          "durationSeconds": 696,
          "maxElevation": 42.1,
          "maxElevationLocal": "08:18",
          "startAzimuth": 12.4,
          "endAzimuth": 190.2,
          "direction": "NNE → S"
        }
      ]
    },
    { "label": "tomorrow", "date": "2025-03-28", "...": "同上結構" }
  ],
  "alwaysVisible": [
    { "name": "ZHONGXING-6C", "noradId": "44231", "series": "ZHONGXING",
      "seriesLabel": "中星 (Communications)", "meanMotion": 1.0027, "maxElevation": 48.7 }
  ],
  "generatedAt": "2025-03-27T04:00:00.000Z"
}
```

`window` 是實際起訖（`0812-0824`），`hourWindow` 是所屬的整點時段（`0800-0900`）；
`hours` 為 24 個整點分桶，供時間軸圖表直接使用。同步軌道衛星不會產生跨日的假時間窗，
而是列入 `alwaysVisible`。
</details>

## Getting Started

### Prerequisites

- Node.js >= 18

### Installation

```bash
git clone https://github.com/s0914712/hash-generator-backend.git
cd hash-generator-backend
npm install
```

### Run Locally

```bash
node index.js
```

Server starts at `http://localhost:3000`

### Deploy to Vercel

```bash
npm i -g vercel
vercel
```

## Caching Strategy

| Cache | TTL | Description |
|---|---|---|
| TLE Data | 2 hours | CelesTrak 衛星軌道元素快取，失敗時回退至過期資料 |
| Pass Summary | 3 hours | 每日過境摘要計算結果快取 |
| China Passes | 3 hours | 中國衛星通過時間表快取，依台北日期分鍵，跨日自動失效 |
| Cron Warm-up | Daily 04:00 UTC | 預熱 6 個衛星群組 + 18 個中國衛星系列 |

## Supported Satellite Series

| Country | Series |
|---|---|
| China | YAOGAN, GAOFEN, BEIDOU, FENGYUN, TIANGONG, SHENZHOU, TIANZHOU, ZHONGXING, SHIYAN, SHIJIAN, JILIN, YUNHAI, HAIYANG, TIANHUI, HUANJING, ZIYUAN, TIANTONG, CHUANGXIN |
| Japan | HIMAWARI, MICHIBIKI, ALOS |
| USA | GOES, LANDSAT, NOAA, TDRS |
| India | CARTOSAT, INSAT |
| Russia | COSMOS |
| International | STARLINK, ONEWEB, IRIDIUM |

## License

ISC
