# PandaData 分钟行情读取

数据库支持 `columns + rows` 和 `columns + data` 矩阵响应；列名必须唯一、非空，且每行长度匹配。截断预览不作为完整历史写入缓存。

`get_future_min` 数据源可设置 `rollingDay: true`。刷新时使用当前北京时间日期至后续 3 天作为交易日标签范围，覆盖周五夜盘归属周一的情况。该选项仅支持 PandaData 期货分钟源；消费者仍须过滤未来 K 线并检查所需历史覆盖。
