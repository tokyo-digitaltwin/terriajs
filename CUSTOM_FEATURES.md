# 東京都デジタルツイン 3D ビューア独自の設定項目

東京都デジタルツイン 3D ビューアのカタログアイテムには、[TerriaJSの公式ドキュメント](https://docs.terria.io/guide/)に記載のない設定項目(Traits)があります。

## 前カタログアイテム共通

| Trait            | Type   | Default | Description                                                                         |
| :--------------- | :----- | :------ | ----------------------------------------------------------------------------------- |
| customProperties | object |         | 東京都デジタルツイン 3D ビューア独自の機能に必要なプロパティを設定するためのtrait。 |

### customPropertiesに設定可能なプロパティ
| Property            | Type     | Description                                                                                                                       |
| :------------------ | :------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| switchableUrls      | object[] | 3DTilesのurlをUIで切り替えるためのプロパティ。`{"name": string, "url": string }` 形式のobjectの配列。                             |
| multipleDownload    | boolean  | カタログアイテムが複数ダウンロード機能の対象であるかどうかを示すプロパティ。trueで複数ダウンロード機能対象となる。                |
| downloadUrlProperty | string   | 複数ダウンロード機能で、ダウンロードURLが記述されているデータの属性名を指定するプロパティ。                                       |
| stories             | object[] | ワークベンチ内のボタンからストーリーを再生する機能を設定するプロパティ。 `{"name": string, "items": any[]}`形式の配列で記述する。 |
| initialCamera       | object   | ワークベンチ内の「データ視点移動」ボタンクリックで移動する位置をオーバライドするプロパティ。                                          |

## KmlCatalogItem に追加されたtraits
| Trait         | Type    | Default | Description                                                                                                                                                                   |
| :------------ | :------ | :------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dataSourceUri | string  |         | 相対リンクやその他のネットワークフィーチャの解決に用いるURLをオーバーライドするプロパティ。                                                                                   |
| clampToGround | boolean | true    | 地物を地表にクランプさせるかどうかを設定するプロパティ。`true`でクランプする（動作の詳細については、「[KMLを3Dで表示するための条件](#KMLを3Dで表示するための条件)」を参照）。 |



### KMLを3Dで表示するための条件

-	3Dジオメトリを持つKMLデータを使用
-	KMLデータと3Dビューアのデータカタログの双方にaltitude modeを設定（下表参照）

<table>
  <thead>
  <tr>
    <th colspan="2" rowspan="2"></th>
    <th  colspan="3">データカタログ設定</th>
  </tr>
  <tr>
    <td>clampToGround<br>=True</td>
    <td>clampToGround<br>=False</td>
    <td>設定なし</td>
  </tr>
  </thead>
  <tbody>
    <tr>
      <th rowspan="4">KML設定</th>
      <td>relativeToGround</td>
      <td>標高に基づく<br>3D表示</td>
      <td>標高に基づく<br>3D表示</td>
      <td>標高に基づく<br>3D表示</td>
    </tr>
    <tr>
      <td>clampToGround</td>
      <td>地形データに<br>張り付いた2D表示</td>
      <td>標高0mでの2D表示</td>
      <td>地形データに<br>張り付いた2D表示</td>
    </tr>
    <tr>
      <td>absolute</td>
      <td>標高に基づく<br>3D表示</td>
      <td>標高に基づく<br>3D表示</td>
      <td>標高に基づく<br>3D表示</td>
    </tr>
    <tr>
      <td>設定なし</td>
      <td>地形データに<br>張り付いた2D表示</td>
      <td>標高0mでの2D表示</td>
      <td>地形データに<br>張り付いた2D表示</td>
    </tr>    
  </tbody>
</table>
