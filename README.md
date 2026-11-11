# TCAD Studio (dummy)

半導体 TCAD ツール（プロセス／デバイスシミュレータ）の **GUI の外側だけ** を再現したダミーアプリです。
ソルバーは一切入っておらず、表示される構造・ドーピング分布・I-V 特性・ログはすべて作り物の式から生成しています。

## 画面構成

| タブ | 内容 |
|---|---|
| Workbench | ツールフロー（ProcSim → MeshGen → DevSim → Plot）× パラメータ（Lg, Tox, Vd）の実験表。Run でノードが queued → running → done/failed と遷移し、Vth を抽出表示 |
| Structure | MOSFET 断面の 2D 分布（NetActive / ElectronDensity / ElectricField）、メッシュ・接合線表示、マウスでプローブ |
| Command File | 各ツールのコマンドファイル編集。「Preprocessed view」で `@Lg@` などのパラメータ置換後を表示 |
| Visual | 実行済み実験の Id–Vg / Id–Vd カーブ（log/linear 切替） |

下部にログコンソール、左にプロジェクトツリーとプロパティを表示します。

## 起動

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ に静的ビルド
```

Vite + React + TypeScript。依存は React のみ。
