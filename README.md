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

- 各戦略は **配分タイムライン(レッグ)** + ノート(Markdown) + 初期資金(円)。
  各レッグは「日付 → 銘柄ごとの配分(%)」で、残りは **円キャッシュ**(リターン0%)。
- **途中でポートフォリオを移動(リバランス)**: レッグを複数置くと、その日付で
  全額を新しい配分へ組み替える(売却→円→買い直し)。レッグが1つなら単純な
  バイ&ホールド。
- **円建て(為替込み)**: USD 等の外貨建て銘柄は `<通貨>JPY=X` の為替で円換算するため、
  株価と為替の両方の効果が評価額に反映される。
- 複数戦略を1つのチャートに重ねて比較。各戦略の **評価額・トータル/年率リターン・
  最大ドローダウン** とリバランス時点を表示。
- ノートは **Markdown** で記述でき、戦略カードに整形表示される。

## ポートフォリオ(実トレード記録)

`/portfolio` で、**実際に行ったトレード**を日付つきで記録し、現在価格で
ライブ評価できる(戦略の仮想バックテストとは別物)。

- トレードは **買い/売り** を「**株数** または **金額(円)**」で記録(行ごとに選択)。
  約定価格は既定で **その日の終値**、手入力で上書き可。
- **自動資金投入モデル**: 買いはその時点で不足分を「投下資本」として投入、
  売却代金は **現金** として保有し次の買いに使える。入金の手入力は不要。
- エントリー/エグジットの**タイミングがそのまま残る**。評価額の推移(エクイティ
  カーブ)・**実現/含み損益・トータルリターン・最大ドローダウン**・保有明細を
  円建て(為替込み)で表示。
- 戦略と同様、複数作成でき、ノート(Markdown)も書ける。

## データの保存と編集(backend が source of truth)

ウォッチリストと戦略は **backend の JSON ファイル** (`backend/data/store.json`) に
保存される。frontend の UI も、その他の呼び出し元(例: `curl` やアシスタント)も、
**同じ CRUD API** を通して読み書きするため常に同期する。投資対象は既定20銘柄 +
ウォッチリストに追加した銘柄からクイック選択する。

```bash
# 例: ウォッチリストに追加
curl -X POST localhost:8000/api/watchlist -H 'Content-Type: application/json' \
  -d '{"symbol":"AAPL","label":"Apple"}'

# 例: 戦略のノート(Markdown)とリバランスを更新
curl -X PUT localhost:8000/api/strategies/<id> -H 'Content-Type: application/json' \
  -d '{"notes":"# 方針\n- ...","legs":[ ... ]}'
```

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
| `GET/POST/DELETE /api/watchlist[/{symbol}]` | ウォッチリストの取得・追加・削除 |
| `GET/POST/PUT/DELETE /api/strategies[/{id}]` | 戦略の取得・作成・更新・削除 |
| `POST /api/backtest` | インライン戦略のバックテスト |
| `POST /api/strategies/{id}/backtest` | 保存済み戦略のバックテスト |
| `GET/POST/PUT/DELETE /api/portfolios[/{id}]` | ポートフォリオの取得・作成・更新・削除 |
| `POST /api/portfolios/{id}/trades` | トレードを1件追加 |
| `DELETE /api/portfolios/{id}/trades/{trade_id}` | トレードを1件削除 |
| `GET /api/portfolios/{id}/performance` | ポートフォリオのライブ評価(円建て) |
| 共通クエリ `range` | `1D,5D,1M,6M,1Y,5Y` |
| 共通クエリ `?refresh=true` | サーバーキャッシュを無視して再取得 |

`POST /api/backtest` のリクエスト例(レッグ = リバランスのタイムライン):

```json
{
  "legs": [
    { "date": "2022-01-01", "allocations": [{ "symbol": "XLK", "weight": 80 }] },
    { "date": "2023-07-01", "allocations": [{ "symbol": "XLV", "weight": 50 }, { "symbol": "XLP", "weight": 50 }] }
  ],
  "initialJpy": 1000000
}
```

`slug` はセクターはティッカー(`XLK` など)、指数は `sp500` / `nasdaq` / `dow` /
`russell2000` / `nikkei` / `ftse` / `dax` / `hangseng` / `vix`。詳細ページは
`/markets/{slug}`。
