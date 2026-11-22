# DLook 历史低价 API

按 DLsite 商品 ID 批量查询 DLook 已记录的最低价及对应折扣。接口返回 JSON，金额以日元计。请求无需登录、Cookie 或 API Key。

## 请求

```http
GET https://dlook.site/api/price-lows?ids=RJ01735938,BJ03050815,RJ9999999999
```

在一个 `ids` 参数中传入 1 至 50 个逗号分隔的商品 ID。ID 由 `RJ`、`BJ` 或 `VJ` 和 6 至 10 位数字组成，可从 DLsite 商品链接的 `product_id` 后取得。接口接受小写 ID，去除首尾空白，按首次出现的顺序去重，并以大写返回。

```sh
curl -fsS 'https://dlook.site/api/price-lows?ids=RJ01735938,BJ03050815,RJ9999999999'
```

## 成功响应

HTTP 200。示例金额会随 DLook 的记录更新。

```json
{
  "currency": "JPY",
  "items": [
    { "id": "RJ01735938", "historicalLowPrice": 440, "off": 20 },
    { "id": "BJ03050815", "historicalLowPrice": 2200, "off": 0 },
    { "id": "RJ9999999999", "historicalLowPrice": null, "off": null }
  ]
}
```

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `currency` | string | 固定为 `JPY`。 |
| `items` | array | 每个去重后的请求 ID 对应一项。 |
| `items[].id` | string | 大写的 DLsite 商品 ID。 |
| `items[].historicalLowPrice` | number 或 null | 已记录的最低日元价。免费为 `0`，缺少可用价格为 `null`。 |
| `items[].off` | number 或 null | 达到该最低价时对应的折扣百分数，`20` 表示 `20% OFF`。原价对应 `0`，折扣无法确认时为 `null`。 |

最低价在 DLook 收录的原价与已生效的有效促销价中计算。已结束且记录完整的促销也参与计算。多次达到同一最低价时，返回其中可确认的最高 OFF。查询结果反映 DLook 已收录的数据，当前售价和购买条件以 DLsite 商品页为准。

服务端按商品缓存结果。有价格的记录最多复用 60 秒，缺少价格的记录最多复用 10 秒。响应头 `X-DLook-Cache` 的值为 `HIT`（全部命中）、`PARTIAL`（部分命中）或 `MISS`（全部重新查询）。需要重新查询已收录的数据时，可发送请求头 `Cache-Control: no-cache`。

## 错误响应

| HTTP 状态 | `error.code` | 含义 |
| --- | --- | --- |
| `400` | `INVALID_QUERY` | `ids` 缺失、为空、重复传参、格式不正确，或去重前超过 50 项。 |
| `503` | `CATALOG_UNAVAILABLE` | 商品数据暂时不可用，可稍后重试。 |

```json
{
  "error": {
    "code": "INVALID_QUERY",
    "message": "请提供 1 至 50 个有效的 DLsite 商品 ID"
  }
}
```
