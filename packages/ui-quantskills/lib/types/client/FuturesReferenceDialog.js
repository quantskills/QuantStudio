import { jsxs as _jsxs, Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { ActionDialog } from "./ActionDialog.js";
import css from './DatabasePage.module.css';
const sourceStatus = {
    available: '已查到',
    missing: '该交易日归档缺失，休市日也可能无归档',
    unsupported: '该交易所暂未接入此类逐日数据',
    no_contract: '该日未查到对应合约记录',
    login_required: '请在设置中连接 PandaData 后查询',
    error: '来源暂不可读或文件格式异常，可重试',
};
const cutoffStatus = { visible: '该报告版本在截止前已更新', after_cutoff: '该报告版本晚于截止时间', unknown: '该报告版本的可见时点未证实' };
const percent = (value) => value === null ? '—' : `${Number((value * 100).toFixed(8))}%`;
const dateSpan = (days, from, through) => days ? `${days} 日（${from} 至 ${through}）` : '样本暂无覆盖';
function Source({ label, source }) {
    if (!source)
        return null;
    return _jsxs("div", { className: css.futuresSource, children: [_jsxs("p", { children: [label, " \u00B7 ", sourceStatus[source.status], source.url && _jsxs(_Fragment, { children: [" \u00B7 ", _jsxs("a", { href: source.url, target: "_blank", rel: "noreferrer", children: [source.provider === 'pandadata' ? 'PandaData 来源' : '交易所来源', source.url.startsWith('http:') ? '（HTTP）' : ''] })] })] }), source.status === 'available' && _jsxs("p", { children: ["\u9996\u6B21\u516C\u5E03\u65F6\u95F4\u672A\u77E5", source.sourceUpdatedAt && _jsxs(_Fragment, { children: [" \u00B7 \u6E90\u6587\u4EF6\u66F4\u65B0\u65F6\u95F4 ", source.sourceUpdatedAt.slice(0, 19).replace('T', ' '), "\uFF08\u5317\u4EAC\u65F6\u95F4\uFF09"] })] }), source.cutoff && _jsx("p", { children: cutoffStatus[source.cutoff] })] });
}
function Product({ product, catalogDate }) {
    return _jsxs("section", { className: css.futuresSection, "aria-label": "\u54C1\u79CD\u76EE\u5F55", children: [_jsxs("h3", { children: [product.name, " \u00B7 ", product.product] }), _jsxs("dl", { className: css.meta, children: [_jsxs("div", { children: [_jsx("dt", { children: "\u73B0\u884C\u6700\u5C0F\u4EF7\u4F4D" }), _jsx("dd", { children: product.tickText })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u73B0\u884C\u5408\u7EA6\u4E58\u6570" }), _jsxs("dd", { children: [product.multiplier, "\uFF08", product.tradingUnit, "\uFF09"] })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u73B0\u884C\u5206\u7C7B" }), _jsx("dd", { children: product.currentCategory })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u76EE\u5F55\u7248\u672C" }), _jsxs("dd", { children: [catalogDate, " \u00B7 ", _jsx("a", { href: product.sourceUrl, target: "_blank", rel: "noreferrer", children: "\u5408\u7EA6\u89C4\u5219\u6765\u6E90" })] })] })] }), _jsxs("details", { children: [_jsx("summary", { children: "\u5DF2\u6838\u9A8C\u7684\u5386\u53F2\u8986\u76D6" }), _jsxs("dl", { className: css.meta, children: [_jsxs("div", { children: [_jsx("dt", { children: "\u884C\u60C5\u6837\u672C" }), _jsx("dd", { children: dateSpan(product.coverage.quoteDays, product.coverage.quoteFrom, product.coverage.quoteThrough) })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u7ED3\u7B97\u53C2\u6570\u6837\u672C" }), _jsx("dd", { children: dateSpan(product.coverage.feeDays, product.coverage.feeFrom, product.coverage.feeThrough) })] })] })] })] });
}
function History({ result }) {
    const { historicalRule: rule, contractTerms: terms, fees, quote, main } = result;
    return _jsxs("section", { className: css.futuresSection, "aria-label": "\u5386\u53F2\u67E5\u8BE2\u7ED3\u679C", children: [_jsxs("h3", { children: [result.date, " \u00B7 ", result.contract ?? '无可定位的合约'] }), _jsxs("dl", { className: css.meta, children: [_jsxs("div", { children: [_jsx("dt", { children: "\u4E3B\u529B\u5408\u7EA6" }), _jsx("dd", { children: main ? `${main.contract} · ${main.method === 'after_close' ? '按当日收盘持仓量、成交量、合约代码重算' : 'PandaData 主力映射'}` : '暂无证据' })] }), quote && _jsxs("div", { children: [_jsx("dt", { children: "\u5F53\u65E5\u884C\u60C5" }), _jsxs("dd", { children: ["\u7ED3\u7B97\u4EF7 ", quote.settlement ?? '—', " \u00B7 \u6210\u4EA4\u91CF ", quote.volume ?? '—', " \u624B \u00B7 \u6301\u4ED3\u91CF ", quote.openInterest ?? '—', " \u624B"] })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u5F53\u671F\u6700\u5C0F\u4EF7\u4F4D" }), _jsx("dd", { children: rule?.tickSize ?? '暂无核实条款' })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u5F53\u671F\u5408\u7EA6\u4E58\u6570" }), _jsx("dd", { children: rule?.multiplier ?? '暂无核实条款' })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u5386\u53F2\u677F\u5757" }), _jsx("dd", { children: rule?.historicalSector && rule.sectorSourceUrl ? _jsxs("a", { href: rule.sectorSourceUrl, target: "_blank", rel: "noreferrer", children: [rule.historicalSector, "\uFF08\u6307\u6570\u7F16\u5236\u65B9\u6848\uFF09"] }) : '暂无当期证据' })] }), rule && _jsxs("div", { children: [_jsx("dt", { children: "\u6761\u6B3E\u6838\u9A8C\u533A\u95F4" }), _jsxs("dd", { children: [rule.validFrom, " \u81F3 ", rule.validThrough, " \u00B7 ", _jsx("a", { href: rule.sourceUrl, target: "_blank", rel: "noreferrer", children: "\u5386\u53F2\u6761\u6B3E" })] })] }), terms && _jsxs("div", { children: [_jsx("dt", { children: "\u5408\u7EA6\u65E5\u671F" }), _jsxs("dd", { children: ["\u6302\u724C ", terms.listedDate ?? '—', " \u00B7 \u6700\u540E\u4EA4\u6613 ", terms.lastTradingDate ?? '—', _jsxs("small", { children: ["\u4EA4\u5272 ", terms.deliveryStart ?? '—', " \u81F3 ", terms.deliveryEnd ?? '—'] })] })] })] }), _jsx(Source, { label: "\u5F53\u65E5\u884C\u60C5", source: result.quoteSource }), result.contractSource?.status !== 'unsupported' && _jsx(Source, { label: "\u5408\u7EA6\u65E5\u671F\u8D44\u6599", source: result.contractSource }), fees && _jsxs(_Fragment, { children: [_jsx("div", { className: css.table, children: _jsxs("table", { "aria-label": "\u4EA4\u6613\u6240\u624B\u7EED\u8D39", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { scope: "col", children: "\u6210\u4EA4\u65B9\u5411" }), _jsx("th", { scope: "col", children: "\u5143 / \u624B" }), _jsx("th", { scope: "col", children: "\u6210\u4EA4\u989D\u8D39\u7387" })] }) }), _jsx("tbody", { children: [['开仓', fees.open], ['平昨', fees.closePrevious], ['平今', fees.closeToday]].map(([label, fee]) => _jsxs("tr", { children: [_jsx("th", { scope: "row", children: label }), _jsx("td", { children: fee.yuanPerLot }), _jsx("td", { children: percent(fee.rate) })] }, label)) })] }) }), _jsxs("p", { className: css.futuresHint, children: ["\u4EA4\u6613\u6240\u6807\u51C6\u3002\u4FDD\u8BC1\u91D1\u7387 \u591A\u5934 ", percent(fees.marginLong), " \u00B7 \u7A7A\u5934 ", percent(fees.marginShort), "\u3002"] })] }), _jsx(Source, { label: "\u5F53\u65E5\u7ED3\u7B97\u53C2\u6570", source: result.feeSource })] });
}
export function FuturesReferenceDialog({ access, close }) {
    const [catalog, setCatalog] = useState();
    const [exchange, setExchange] = useState('SHFE');
    const [productCode, setProductCode] = useState('');
    const [contract, setContract] = useState('');
    const [date, setDate] = useState('');
    const [cutoff, setCutoff] = useState('');
    const [attempt, setAttempt] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState();
    useEffect(() => {
        let active = true;
        access.catalog().then(catalog => { if (active)
            setCatalog(catalog); })
            .catch(() => { if (active)
            setError('暂时无法打开期货品种目录。'); });
        return () => { active = false; };
    }, [access, attempt]);
    const products = catalog?.products.filter(product => product.exchange === exchange) ?? [];
    const product = products.find(item => item.product === productCode) ?? products[0];
    return _jsx(ActionDialog, { title: "\u671F\u8D27\u53C2\u8003", wide: true, busy: busy, error: error, onClose: close, children: !catalog ? error ? _jsx("button", { onClick: () => { setError(''); setAttempt(attempt + 1); }, children: "\u91CD\u8BD5" }) : _jsx("p", { role: "status", children: "\u6B63\u5728\u8BFB\u53D6\u671F\u8D27\u54C1\u79CD\u76EE\u5F55\u2026" }) : _jsxs(_Fragment, { children: [_jsx("form", { className: css.form, onChange: () => { setResult(undefined); setError(''); }, onSubmit: async (event) => {
                        event.preventDefault();
                        if (!product || busy)
                            return;
                        setBusy(true);
                        setError('');
                        setResult(undefined);
                        try {
                            const next = await access.query({ exchange, symbol: contract.trim() || product.product, date, ...(cutoff ? { cutoff } : {}) });
                            if (next.product.product !== product.product)
                                throw new Error('合约代码与所选品种不一致。');
                            setResult(next);
                        }
                        catch (e) {
                            setError(e instanceof Error ? e.message : String(e));
                        }
                        finally {
                            setBusy(false);
                        }
                    }, children: _jsxs("div", { className: css.futuresFields, children: [_jsxs("label", { children: ["\u4EA4\u6613\u6240", _jsx("select", { value: exchange, disabled: busy, onChange: event => { setExchange(event.target.value); setProductCode(''); setContract(''); }, children: catalog.exchanges.map(item => _jsxs("option", { value: item.id, children: [item.name, " (", item.id, ")"] }, item.id)) })] }), _jsxs("label", { children: ["\u54C1\u79CD", _jsx("select", { value: product?.product ?? '', disabled: busy, onChange: event => { setProductCode(event.target.value); setContract(''); }, children: products.map(item => _jsxs("option", { value: item.product, children: [item.product, " \u00B7 ", item.name] }, item.product)) })] }), _jsxs("label", { children: ["\u4EA4\u6613\u65E5", _jsx("input", { type: "date", required: true, value: date, disabled: busy, onChange: event => setDate(event.target.value) })] }), _jsxs("label", { children: ["\u5408\u7EA6\u4EE3\u7801\uFF08\u53EF\u9009\uFF09", _jsx("input", { value: contract, maxLength: 24, spellCheck: false, disabled: busy, placeholder: "\u7559\u7A7A\u65F6\u67E5\u8BE2\u5F53\u65E5\u4E3B\u529B", onChange: event => setContract(event.target.value) })] }), _jsxs("label", { children: ["\u53EF\u89C1\u65F6\u70B9\uFF08\u5317\u4EAC\u65F6\u95F4\uFF0C\u53EF\u9009\uFF09", _jsx("input", { type: "datetime-local", value: cutoff, disabled: busy, onChange: event => setCutoff(event.target.value) })] }), _jsx("button", { type: "submit", disabled: !product || !date || busy, children: busy ? '查询中…' : '查询历史' })] }) }), result && _jsx(History, { result: result }), product && _jsx(Product, { product: product, catalogDate: catalog.snapshotDate })] }) });
}
//# sourceMappingURL=FuturesReferenceDialog.js.map