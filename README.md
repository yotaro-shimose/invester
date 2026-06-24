# Sector Pulse — 株価ビューア & ペーパートレード

yfinance から米国セクター ETF・主要指数・任意ティッカーの株価を取得して可視化し、
「あの時この戦略にしていたら」を振り返るペーパートレード(バックテスト)もできるアプリ。

- **バックエンド**: Python + FastAPI + yfinance (`backend/`) — データ取得・整形・キャッシュ・バックテスト
- **フロントエンド**: Next.js + Tailwind + lightweight-charts (`frontend/`) — 表示専用

**主要指数**: S&P 500 / NASDAQ総合 / ダウ平均 / ラッセル2000 / 日経225 /
FTSE100 / DAX / ハンセン / VIX

**セクター(米国11セクター ETF)**: XLK 情報技術 / XLC 通信サービス / XLY
一般消費財 / XLP 生活必需品 / XLV ヘルスケア / XLF 金融 / XLI 資本財 / XLE
エネルギー / XLB 素材 / XLU 公益 / XLRE 不動産

トップページでは**期間(1D〜5Y)を切り替え**でき、各カードはその期間の騰落率と
スパークラインを表示する。

**ウォッチリスト**: 任意の yfinance ティッカー(例: `AAPL`, `7203.T`)を追加すると
ダッシュボードにカードが並び、詳細チャートも見られる(localStorage に保存)。

## ペーパートレード(戦略バックテスト)

`/strategies` で「戦略」を作成・比較できる。

- 各戦略は **銘柄 → 配分(%)** のリスト + **開始日** + 初期資金(円)。配分の残りは
  **円キャッシュ**(リターン0%)として保有。
- **バイ&ホールド**: 開始日に円で買い付け、以降は保有しっぱなしで日次評価。
- **円建て(為替込み)**: USD 等の外貨建て銘柄は `<通貨>JPY=X` の為替で円換算するため、
  株価と為替の両方の効果が評価額に反映される。
- 複数戦略を1つのチャートに重ねて比較。各戦略の **評価額・トータル/年率リターン・
  最大ドローダウン** を表示。「あの時この戦略にしていたら ¥X(+Y%)」が一目で分かる。
- 戦略はブラウザの localStorage に保存(サーバー DB 不要)。投資対象は
  既定20銘柄 + ウォッチリストに追加した銘柄からクイック選択。

## 起動

### 1. バックエンド (port 8000)

Python プロジェクトは `backend/` で完結している(`pyproject.toml` / `uv.lock` /
`.python-version` / `.venv` はすべて `backend/` 配下)。

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

### 2. フロントエンド (port 3000)

```bash
cd frontend
npm install
npm run dev
```

ブラウザで <http://localhost:3000> を開く。

API のベース URL は `frontend/.env.local` の `NEXT_PUBLIC_API_URL` で変更できる。

## データの鮮度について

- フロントは画面表示時にブラウザ側で都度データを取得する（静的ビルドに古い
  データは焼き込まれない）。fetch は `cache: "no-store"` でブラウザキャッシュ
  も回避する。
- **タブにフォーカスが戻ったとき**と**表示中は60秒ごと**に自動で再取得する。
- 「↻ 更新」ボタンは `?refresh=true` でサーバー側キャッシュも無視して最新を
  取りに行く。各レスポンスには取得時刻 (`asOf` / `ageSeconds`) が含まれ、画面
  に「最終更新」として表示される。
- バックエンドは yfinance への過剰アクセスを避けるため、概要は60秒・チャート
  は120秒の TTL キャッシュを持つ（`refresh=true` でバイパス可能）。

## API

| Endpoint | 説明 |
| --- | --- |
| `GET /api/sectors?range=1M` | 11セクターの最新価格・期間騰落率・スパークライン |
| `GET /api/indices?range=1M` | 主要指数の最新価格・期間騰落率・スパークライン |
| `GET /api/quotes?symbols=AAPL&symbols=MSFT&range=1M` | 任意ティッカーの概要(ウォッチリスト用) |
| `GET /api/markets/{slug}/history?range=1Y` | OHLC チャート用データ(任意ティッカー可) |
| `POST /api/backtest` | 戦略のバックテスト(円建て・バイ&ホールド) |
| 共通クエリ `range` | `1D,5D,1M,6M,1Y,5Y` |
| 共通クエリ `?refresh=true` | サーバーキャッシュを無視して再取得 |

`POST /api/backtest` のリクエスト例:

```json
{
  "allocations": [{ "symbol": "XLK", "weight": 60 }, { "symbol": "^N225", "weight": 20 }],
  "start": "2023-01-01",
  "initialJpy": 1000000
}
```

`slug` はセクターはティッカー(`XLK` など)、指数は `sp500` / `nasdaq` / `dow` /
`russell2000` / `nikkei` / `ftse` / `dax` / `hangseng` / `vix`。詳細ページは
`/markets/{slug}`。
