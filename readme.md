# Taiwan Satellite Tracker 3D

> 台灣衛星追蹤器 — 即時 3D 衛星追蹤、軌道預測與過境分析平台

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)](https://hash-generator-backend-ten.vercel.app)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js)](https://expressjs.com/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)

## Demo

- **Dashboard** — 完整功能的衛星追蹤儀表板：[index.html](https://s0914712.github.io/hash-generator-backend/index.html)
- **Showcase** — 指揮中心風格的視覺化介面：[showcase.html](https://s0914712.github.io/hash-generator-backend/showcase.html)

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

### 雙前端介面
| Dashboard (`index.html`) | Showcase (`showcase.html`) |
|---|---|
| 傳統儀表板佈局 | 軍事指揮中心 HUD 風格 |
| 右側摺疊式側邊欄 | 四角 HUD 面板 |
| 高度範圍篩選器 | 底部衛星晶片選擇列 |
| 搜尋功能 | 即時 UTC 時鐘 |
| 深藍色主題 | 暗黑 + 青色/綠色主題 |

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
│   ├── propagator.js           # 軌道傳播計算（位置、軌道、過境）
│   └── router.js               # API 路由
└── docs/
    ├── index.html              # Dashboard 前端
    └── showcase.html           # Showcase 前端
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
| Cron Warm-up | Daily 04:00 UTC | 預熱 6 個衛星群組 + 8 個中國衛星系列 |

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
