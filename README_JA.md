# mcpx-mcp-server
<img alt="License" src="https://img.shields.io/badge/license-MIT-brightgreen.svg" />
<p>
  <a href="README_JA.md">日本語</a> | <a href="README.md">English</a>
</p>

## 概要
mcpx-mcp-server は、生成AIから三菱電機製PLCのデバイスにリアルタイムでアクセスするための MCPサーバー です。

PLCの通信には MCプロトコルライブラリ [McpX](https://github.com/YudaiKitamura/McpX) の NativeAOT ビルド版 を使用しています。

![動作イメージ](image.gif)
## できること
- PLCのデバイスをリアルタイム読み出し
- PLCのデバイスへ書き込み
- 生成AIによる自然言語指示での操作
- 名前指定での操作
  - 事前に定義した名前を使うことで、アドレスを意識せずに操作可能

## プロンプト例
- コンベアAを運転してください。
- コンベアAを停止してください。
- ゲートAの状態は？
- ゲートAを開けた後にコンベアAを運転してください。
- 現状の生産数は？
- 目標生産数を9999に設定してください。

## 使用方法
### 前提条件
以下のアプリケーションがインストールされている必要があります。
- [Docker](https://www.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/)

### デバイス定義
事前にデバイス定義（`app/src/address-comment.json`）を設定することで、命名アクセスやアクセス時のルールを適応した操作が可能になります。

|項目|内容|
|---|---|
|address|アドレスを指定します。|
|name|名前を指定します。|
|comment|データ型やルールを指定します。|

> ※デバイス定義を変更した際は、MCPサーバーの再起動が必要です。

#### 設定例
```json
[
  { "address": "M0", "name": "コンベアA 運転指令", "comment": "trueで運転、falseで停止" },
  { "address": "M1", "name": "コンベアA 運転状態", "comment": "trueで運転、falseで停止" },
  { "address": "M2", "name": "ゲートA 開指令", "comment": "trueで開、falseで閉" },
  { "address": "M3", "name": "ゲートA 状態", "comment": "trueで開、falseで閉" },
  { "address": "D0", "name": "生産数", "comment": "short型" }
]
```

### MCPサーバー起動
```sh
docker compose up -d
```

### MCPサーバー停止 
```sh
docker compose down
```

### MCPサーバー設定
使用する生成AIに応じて、MCPサーバーを設定してください。
#### Gemini CLIの設定例
##### Mac
`/Users/{ユーザー名}/.gemini/settings.json`
##### Linux
`/home/{ユーザー名}/.gemini/settings.json`
##### Windows
`C:\Users\{ユーザー名}\.gemini\settings.json`

##### 設定内容
`settings.json` に MCPサーバー情報を追加します。
```json
{
  "security": {
    "auth": {
      "selectedType": "oauth-personal"
    }
  },

  // 以下を追加
  "mcpServers": {
    "mcpx": {
      "httpUrl": "http://localhost:3000/mcp"
    }
  }
}
```
