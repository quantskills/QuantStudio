import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from 'react';
import { DatabaseIcon, PlusIcon, ArrowClockwiseIcon, TrashIcon, MagnifyingGlassIcon, TableIcon, ChartLineIcon, NewspaperIcon, BuildingsIcon, UploadSimpleIcon, CloudArrowDownIcon, XIcon } from '@phosphor-icons/react';
import { ActionDialog } from "./ActionDialog.js";
import css from './DatabasePage.module.css';
const categories = [
    { id: 'market', label: '行情', description: '价格、成交量、盘口与历史 K 线', icon: ChartLineIcon },
    { id: 'news', label: '新闻', description: '新闻快讯、公司公告与市场事件', icon: NewspaperIcon },
    { id: 'fundamental', label: '基本面', description: '财务报表、业绩、估值与公司资料', icon: BuildingsIcon },
    { id: 'other', label: '其他', description: '暂未识别的研究数据，可在详情中调整分类', icon: TableIcon },
];
const categoryOf = (item) => categories.find(category => category.id === item.category) ?? categories[3];
const time = (date) => new Date(date).toLocaleString('zh-CN', { hour12: false });
const sourceName = (item) => ({ file: '本地文件', http: '外部接口', pandadata: 'PandaData' })[item.source.kind];
const display = (value) => value == null ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value);
const methodNames = { get_fina_reports: '财务报表', get_fina_performance: '业绩与财务指标', get_daily: '日行情', get_quotes: '实时行情' };
const titleOf = (item) => item.name === item.source.method ? methodNames[item.name] ?? item.name : item.name;
const parameterSummary = (item, compact = false) => {
    const params = item.source.params ?? {};
    return ['symbol', 'symbols', 'code', 'codes', 'ts_code', 'ticker', 'index_code', 'frequency', 'period']
        .filter(key => params[key] !== undefined).map(key => {
        const value = params[key];
        if (!Array.isArray(value))
            return display(value);
        if (compact && value.length > 2)
            return value.slice(0, 2).map(display).join('、') + ' 等 ' + value.length + ' 个标的';
        return value.map(display).join('、');
    }).join(' · ');
};
const coverage = (item) => item.from ? item.from.slice(0, 10) + ' — ' + (item.to?.slice(0, 10) ?? '') : '未设置日期范围';
export function DatabasePage({ access }) {
    const [items, setItems] = useState([]), [selected, setSelected] = useState();
    const [selectedId, setSelectedId] = useState(), [opening, setOpening] = useState(false);
    const [search, setSearch] = useState(''), [filter, setFilter] = useState('all');
    const [adding, setAdding] = useState(false);
    const [removing, setRemoving] = useState();
    const [managing, setManaging] = useState(false), [checked, setChecked] = useState([]);
    const [removedCount, setRemovedCount] = useState(0);
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [loading, setLoading] = useState(true);
    const [from, setFrom] = useState(''), [to, setTo] = useState(''), [minRows, setMinRows] = useState(1);
    const request = useRef(0), detailBody = useRef(null);
    const load = useCallback(async () => { if (access)
        setItems(await access.list()); }, [access]);
    useEffect(() => {
        let active = true;
        if (access)
            access.list().then(data => { if (active)
                setItems(data); }).catch(e => { if (active)
                setError(String(e.message ?? e)); }).finally(() => { if (active)
                setLoading(false); });
        else
            setLoading(false);
        return () => { active = false; request.current++; };
    }, [access]);
    const run = async (work) => { setBusy(true); setError(''); try {
        await work();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : String(e));
    }
    finally {
        setBusy(false);
    } };
    const closeDetail = () => { request.current++; setSelectedId(undefined); setSelected(undefined); setOpening(false); };
    const open = async (id) => {
        if (!access)
            return;
        const version = ++request.current;
        setSelectedId(id);
        setSelected(undefined);
        setOpening(true);
        setError('');
        setFrom('');
        setTo('');
        setMinRows(1);
        if (detailBody.current)
            detailBody.current.scrollTop = 0;
        try {
            const result = await access.preview(id);
            if (version === request.current)
                setSelected(result);
        }
        catch (e) {
            if (version === request.current)
                setError(e instanceof Error ? e.message : String(e));
        }
        finally {
            if (version === request.current)
                setOpening(false);
        }
    };
    const visible = items.filter(item => (filter === 'all' || categoryOf(item).id === filter) && [item.name, titleOf(item), categoryOf(item).label, sourceName(item), parameterSummary(item), ...item.columns].join(' ').toLowerCase().includes(search.trim().toLowerCase()));
    const pendingItem = items.find(item => item.id === selectedId);
    const currentCategory = categories.find(category => category.id === filter);
    const chosen = items.filter(item => checked.includes(item.id));
    const allVisibleChecked = visible.length > 0 && visible.every(item => checked.includes(item.id));
    const askRemove = (mode, targets) => { setError(''); setRemovedCount(0); setRemoving({ mode, items: targets }); };
    const removeConfirmed = async () => {
        if (!access || !removing)
            return;
        const failed = [], messages = [];
        // Freeze the confirmed IDs: new arrivals must not be swept up by a clear operation.
        for (const item of removing.items) {
            try {
                await access.remove(item.id);
                setItems(current => current.filter(value => value.id !== item.id));
                setChecked(current => current.filter(id => id !== item.id));
                if (selectedId === item.id)
                    closeDetail();
                setRemovedCount(count => count + 1);
            }
            catch (e) {
                failed.push(item);
                messages.push(e instanceof Error ? e.message : String(e));
            }
        }
        setRemoving(failed.length ? { mode: removing.mode, items: failed } : undefined);
        await load();
        if (failed.length)
            throw new Error(`${failed.length} 份缓存未删除，可重试。${messages[0] ?? ''}`);
    };
    return _jsxs("div", { className: css.page, children: [_jsxs("header", { className: css.header, children: [_jsxs("div", { children: [_jsx("h1", { children: "\u6570\u636E\u5E93" }), _jsx("p", { children: "\u628A\u884C\u60C5\u3001\u65B0\u95FB\u548C\u57FA\u672C\u9762\u7559\u5728\u672C\u5730\uFF0C\u7814\u7A76\u968F\u65F6\u5F00\u59CB\u3002" })] }), _jsxs("div", { className: css.headerActions, children: [_jsxs("button", { disabled: !access || busy || loading || !items.length, onClick: () => askRemove('all', [...items]), children: [_jsx(TrashIcon, { size: 17 }), "\u6E05\u7A7A\u5168\u90E8\u7F13\u5B58"] }), _jsxs("button", { className: css.primary, disabled: !access || busy, onClick: () => setAdding(true), children: [_jsx(PlusIcon, { size: 18 }), "\u6DFB\u52A0\u6570\u636E"] })] })] }), _jsxs("div", { className: css.notice, children: [_jsx(DatabaseIcon, { size: 21 }), _jsx("span", { children: "AI \u4F18\u5148\u8BFB\u53D6\u672C\u5730\u7F13\u5B58\uFF1B\u8FC7\u671F\u3001\u65E5\u671F\u8303\u56F4\u6216\u6761\u6570\u4E0D\u8DB3\u65F6\uFF0C\u518D\u6309\u9700\u66F4\u65B0\u3002" }), _jsxs("details", { className: css.categoryHelp, children: [_jsx("summary", { children: "\u5982\u4F55\u5206\u7C7B" }), _jsxs("div", { children: [categories.slice(0, 3).map(category => _jsxs("p", { children: [_jsx("b", { children: category.label }), category.description] }, category.id)), _jsx("small", { children: "\u6309\u6570\u636E\u5185\u5BB9\u5206\u7C7B\uFF0C\u662F\u5426\u5E26\u6709\u65E5\u671F\u4E0D\u5F71\u54CD\u5206\u7C7B\u3002\u7CFB\u7EDF\u4F1A\u81EA\u52A8\u8BC6\u522B\uFF0C\u4E5F\u53EF\u624B\u52A8\u8C03\u6574\u3002" })] })] })] }), _jsxs("div", { className: css.toolbar, children: [_jsxs("div", { className: css.tabs, role: "tablist", "aria-label": "\u6570\u636E\u5206\u7C7B", children: [_jsxs("button", { role: "tab", "aria-selected": filter === 'all', onClick: () => setFilter('all'), children: ["\u5168\u90E8", _jsx("span", { children: items.length })] }), categories.map(category => _jsxs("button", { role: "tab", "aria-selected": filter === category.id, title: category.description, onClick: () => setFilter(category.id), children: [category.label, _jsx("span", { children: items.filter(item => categoryOf(item).id === category.id).length })] }, category.id))] }), _jsxs("label", { className: css.search, children: [_jsx(MagnifyingGlassIcon, { size: 17 }), _jsx("input", { "aria-label": "\u641C\u7D22\u6570\u636E\u96C6", placeholder: "\u540D\u79F0\u3001\u80A1\u7968\u4EE3\u7801\u3001\u6765\u6E90\u6216\u5B57\u6BB5", value: search, onChange: event => setSearch(event.target.value) })] }), _jsx("button", { "aria-label": "\u5237\u65B0\u6570\u636E\u76EE\u5F55", disabled: busy || !access, onClick: () => void run(load), children: _jsx(ArrowClockwiseIcon, { size: 18 }) })] }), error && _jsx("p", { role: "alert", className: css.error, children: error }), _jsxs("div", { className: css.layout, "data-selected": !!selectedId, children: [_jsxs("div", { className: css.listPane, children: [_jsxs("div", { className: css.listHeading, children: [_jsx("b", { children: currentCategory?.label ?? '本地数据' }), _jsxs("span", { children: [visible.length, " \u4EFD\u7F13\u5B58"] }), _jsx("button", { disabled: busy || !items.length, "aria-pressed": managing, onClick: () => { setManaging(!managing); setChecked([]); }, children: managing ? '完成' : '批量管理' })] }), managing && _jsxs("div", { className: css.bulkBar, children: [_jsxs("label", { children: [_jsx("input", { type: "checkbox", disabled: busy || !visible.length, checked: allVisibleChecked, onChange: () => setChecked(current => allVisibleChecked ? current.filter(id => !visible.some(item => item.id === id)) : [...new Set([...current, ...visible.map(item => item.id)])]) }), "\u5168\u9009\u5F53\u524D\u5217\u8868"] }), _jsxs("button", { disabled: busy || !chosen.length, onClick: () => askRemove('selected', chosen), children: [_jsx(TrashIcon, { size: 15 }), "\u5220\u9664\u6240\u9009\uFF08", chosen.length, "\uFF09"] })] }), _jsx("section", { className: css.list, "aria-label": "\u672C\u5730\u6570\u636E\u96C6", tabIndex: 0, children: loading ? _jsx("p", { className: css.empty, children: "\u6B63\u5728\u8BFB\u53D6\u672C\u5730\u6570\u636E\u2026" }) : visible.length === 0 ? _jsxs("div", { className: css.empty, children: [_jsx(DatabaseIcon, { size: 32 }), _jsx("h2", { children: items.length ? '没有匹配的数据' : '建立你的研究数据库' }), _jsx("p", { children: currentCategory?.description ?? '连接 PandaData 或外部接口，也可以导入 CSV、JSON 文件。' }), !items.length && _jsx("button", { disabled: !access, className: css.primary, onClick: () => setAdding(true), children: "\u6DFB\u52A0\u7B2C\u4E00\u4EFD\u6570\u636E" })] }) : visible.map(item => {
                                    const category = categoryOf(item), Icon = category.icon, params = parameterSummary(item, true);
                                    const stale = Date.now() >= Date.parse(item.expiresAt);
                                    return _jsxs("article", { className: css.item, "data-selected": selectedId === item.id, children: [managing && _jsx("input", { className: css.selectItem, type: "checkbox", "aria-label": `选择 ${titleOf(item)} ${params}`, checked: checked.includes(item.id), disabled: busy, onChange: event => setChecked(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id)) }), _jsxs("button", { className: css.openItem, "aria-pressed": selectedId === item.id, onClick: () => void open(item.id), disabled: busy, children: [_jsx("span", { className: css.icon, "data-category": category.id, children: _jsx(Icon, { size: 22 }) }), _jsxs("span", { className: css.itemContent, children: [_jsx("b", { title: titleOf(item), children: titleOf(item) }), params && _jsx("small", { className: css.params, title: parameterSummary(item), children: params }), _jsxs("small", { children: [category.label, " \u00B7 ", sourceName(item), " \u00B7 ", item.rowCount.toLocaleString(), " \u884C"] }), _jsx("small", { children: coverage(item) })] })] }), _jsxs("div", { className: css.itemActions, children: [_jsx("span", { className: css.fresh, "data-stale": stale, children: stale ? '待更新' : '可用' }), _jsx("button", { className: css.deleteItem, "aria-label": `删除 ${titleOf(item)} ${params}`, title: "\u5220\u9664\u8FD9\u4EFD\u7F13\u5B58", disabled: busy, onClick: () => askRemove('single', [item]), children: _jsx(TrashIcon, { size: 17 }) })] })] }, item.id);
                                }) })] }), _jsxs("section", { className: css.detail, "aria-label": "\u6570\u636E\u8BE6\u60C5", "aria-busy": opening, children: [_jsxs("header", { className: css.detailHeader, children: [_jsxs("div", { children: [_jsx("h2", { children: selected ? titleOf(selected.dataset) : pendingItem ? titleOf(pendingItem) : '数据详情' }), _jsx("p", { children: selected ? sourceName(selected.dataset) + ' · ' + selected.dataset.rowCount.toLocaleString() + ' 行 · ' + selected.dataset.columns.length + ' 列' : '在左侧选择一份数据，查看来源与内容。' })] }), selectedId && _jsxs("button", { "aria-label": "\u5173\u95ED\u6570\u636E\u8BE6\u60C5\uFF0C\u8FD4\u56DE\u5217\u8868", disabled: busy, onClick: closeDetail, children: [_jsx("span", { className: css.mobileBack, children: "\u8FD4\u56DE\u5217\u8868" }), _jsx(XIcon, { size: 19 })] })] }), _jsx("div", { className: css.detailBody, ref: detailBody, children: opening ? _jsxs("div", { className: css.empty, role: "status", children: [_jsx(ArrowClockwiseIcon, { size: 28 }), _jsx("p", { children: "\u6B63\u5728\u8BFB\u53D6\u6570\u636E\u9884\u89C8\u2026" })] }) : !selected ? _jsxs("div", { className: css.empty, children: [_jsx(TableIcon, { size: 40 }), _jsx("h2", { children: selectedId ? '暂时无法读取数据' : '选择数据，展开研究' }), _jsx("p", { children: "\u5DE6\u4FA7\u5217\u8868\u72EC\u7ACB\u6EDA\u52A8\uFF0C\u8BE6\u60C5\u4F1A\u4FDD\u7559\u5728\u8FD9\u91CC\u3002" }), selectedId && _jsx("button", { onClick: () => void open(selectedId), children: "\u91CD\u8BD5" })] }) : _jsxs(_Fragment, { children: [_jsxs("div", { className: css.categoryRow, children: [_jsxs("label", { children: ["\u6570\u636E\u5206\u7C7B", _jsx("select", { "aria-label": "\u8C03\u6574\u6570\u636E\u5206\u7C7B", value: selected.dataset.category, disabled: busy, onChange: event => { const category = event.target.value; void run(async () => { const dataset = await access.categorize(selected.dataset.id, category); setSelected({ ...selected, dataset }); await load(); }); }, children: categories.map(category => _jsx("option", { value: category.id, children: category.label }, category.id)) })] }), _jsx("span", { children: categoryOf(selected.dataset).description })] }), _jsxs("dl", { className: css.meta, children: [_jsxs("div", { children: [_jsx("dt", { children: "\u6570\u636E\u8303\u56F4" }), _jsx("dd", { children: parameterSummary(selected.dataset) || '—' })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u8986\u76D6\u65E5\u671F" }), _jsxs("dd", { children: [coverage(selected.dataset), selected.dataset.dateColumn && _jsxs("small", { children: ["\u65E5\u671F\u5B57\u6BB5\uFF1A", selected.dataset.dateColumn] })] })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u6700\u8FD1\u66F4\u65B0" }), _jsx("dd", { children: time(selected.dataset.fetchedAt) })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u7F13\u5B58\u6709\u6548\u81F3" }), _jsx("dd", { children: time(selected.dataset.expiresAt) })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u6570\u636E\u6765\u6E90" }), _jsxs("dd", { children: [selected.dataset.source.method ?? selected.dataset.source.url ?? '本地导入', _jsxs("small", { children: [(selected.dataset.bytes / 1024).toFixed(1), " KB \u00B7 ", selected.dataset.name] })] })] })] }), _jsxs("div", { className: css.actions, children: [_jsxs("button", { disabled: busy || selected.dataset.source.kind === 'file', title: selected.dataset.source.kind === 'file' ? '本地文件需要重新导入' : '从原数据源重新拉取', onClick: () => void run(async () => { await access.refresh(selected.dataset.id); await load(); setSelected(await access.preview(selected.dataset.id)); }), children: [_jsx(ArrowClockwiseIcon, { size: 16 }), "\u66F4\u65B0\u7F13\u5B58"] }), _jsxs("button", { disabled: busy, onClick: () => askRemove('single', [selected.dataset]), children: [_jsx(TrashIcon, { size: 16 }), "\u5220\u9664\u7F13\u5B58"] })] }), _jsxs("form", { className: css.query, onSubmit: event => { event.preventDefault(); void run(async () => { setSelected(await access.query({ id: selected.dataset.id, ...(from ? { from } : {}), ...(to ? { to } : {}), minRows, limit: 100 })); await load(); }); }, children: [_jsx("b", { children: "\u68C0\u67E5\u7814\u7A76\u6240\u9700\u6570\u636E" }), selected.dataset.kind === 'timeseries' && _jsxs("div", { className: css.dates, children: [_jsxs("label", { children: ["\u5F00\u59CB\u65E5\u671F", _jsx("input", { type: "date", value: from, onChange: e => setFrom(e.target.value) })] }), _jsxs("label", { children: ["\u7ED3\u675F\u65E5\u671F", _jsx("input", { type: "date", value: to, onChange: e => setTo(e.target.value) })] })] }), _jsxs("div", { className: css.actions, children: [_jsxs("label", { children: ["\u81F3\u5C11", _jsx("input", { type: "number", "aria-label": "\u6240\u9700\u6700\u5C11\u6761\u6570", min: 1, max: 100000, value: minRows, onChange: e => setMinRows(Number(e.target.value)) }), "\u884C"] }), _jsx("button", { disabled: busy, type: "submit", children: busy ? '检查中…' : '检查并按需更新' })] })] }), _jsx("p", { className: css.result, role: "status", children: selected.status === 'insufficient' ? '暂不能满足：' + selected.reasons.join('、') + (selected.rows.length ? '。以下为已有缓存预览，AI 使用前需先更新。' : selected.dataset.source.kind === 'file' ? '。请重新导入文件。' : '。请检查源数据的日期和条数参数。') : selected.status === 'refreshed' ? '已更新缓存，符合本次数据需求。' : '本地缓存可用。' }), _jsx("div", { className: css.table, tabIndex: 0, role: "region", "aria-label": "\u6570\u636E\u8868\u683C\u9884\u89C8", children: _jsxs("table", { children: [_jsx("thead", { children: _jsx("tr", { children: selected.dataset.columns.map(column => _jsx("th", { children: column }, column)) }) }), _jsx("tbody", { children: selected.rows.map((row, i) => _jsx("tr", { children: selected.dataset.columns.map(column => _jsx("td", { title: display(row[column]), children: display(row[column]) }, column)) }, i)) })] }) }), _jsxs("small", { className: css.foot, children: ["\u9884\u89C8\u524D ", selected.rows.length, " \u884C \u00B7 \u5171 ", selected.total.toLocaleString(), " \u884C \u00B7 AI \u53EF\u6309\u9700\u5206\u9875\u8BFB\u53D6"] })] }) })] })] }), adding && access && _jsx(AddData, { access: access, close: () => setAdding(false), done: async (item) => { setAdding(false); setFilter('all'); setSearch(''); await load(); await open(item.id); } }), removing && _jsxs(ActionDialog, { title: removing.mode === 'all' ? '清空全部缓存' : removing.mode === 'selected' ? '删除所选缓存' : '删除本地缓存', busy: busy, error: error, onClose: () => setRemoving(undefined), children: [_jsxs("p", { children: [removing.mode === 'all' ? '将清空所有分类中的' : '将删除', " ", removing.items.length, " \u4EFD\u672C\u5730\u7F13\u5B58\u3002\u4EC5\u79FB\u9664\u7F13\u5B58\u526F\u672C\uFF0C\u4E0D\u5220\u9664\u539F\u59CB\u6587\u4EF6\u3001\u4F1A\u8BDD\u6216\u7814\u7A76\u4EA7\u7269\uFF1B\u9700\u8981\u65F6\u53EF\u91CD\u65B0\u62C9\u53D6\u6216\u5BFC\u5165\u3002"] }), _jsx("ul", { children: removing.items.map(item => _jsxs("li", { children: [titleOf(item), parameterSummary(item, true) ? ` · ${parameterSummary(item, true)}` : ''] }, item.id)) }), busy && _jsxs("p", { role: "status", children: ["\u5DF2\u5220\u9664 ", removedCount, " / ", removing.items.length, " \u4EFD\u7F13\u5B58\u2026"] }), _jsxs("footer", { children: [_jsx("button", { disabled: busy, onClick: () => setRemoving(undefined), children: "\u53D6\u6D88" }), _jsx("button", { "data-danger": true, disabled: busy, onClick: () => { setRemovedCount(0); void run(removeConfirmed); }, children: busy ? '正在删除…' : removing.mode === 'all' ? '确认清空' : '删除缓存' })] })] })] });
}
function AddData({ access, close, done }) {
    const [source, setSource] = useState('file'), [name, setName] = useState(''), [content, setContent] = useState(''), [format, setFormat] = useState('csv');
    const [category, setCategory] = useState('auto'), [dateColumn, setDateColumn] = useState(''), [ttl, setTtl] = useState(60);
    const [url, setUrl] = useState(''), [method, setMethod] = useState(''), [params, setParams] = useState('{}'), [busy, setBusy] = useState(false), [error, setError] = useState('');
    return _jsx(ActionDialog, { title: "\u6DFB\u52A0\u7814\u7A76\u6570\u636E", busy: busy, error: error, onClose: close, children: _jsxs("form", { className: css.form, onSubmit: async (event) => {
                event.preventDefault();
                setError('');
                setBusy(true);
                try {
                    const base = { name, kind: 'auto', ...(category !== 'auto' ? { category } : {}), ttlSeconds: ttl * 60, ...(dateColumn ? { dateColumn } : {}) };
                    if (source === 'file' && !content)
                        throw new Error('请先选择 CSV 或 JSON 文件');
                    const parsed = source === 'pandadata' ? JSON.parse(params) : {};
                    if (source === 'pandadata' && (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)))
                        throw new Error('接口参数应为 JSON 对象');
                    const item = source === 'file' ? await access.import({ ...base, content, format }) : await access.fetch({ ...base, source: source === 'http' ? { kind: source, url } : { kind: source, method, params: parsed } });
                    await done(item);
                }
                catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                }
                finally {
                    setBusy(false);
                }
            }, children: [_jsx("div", { className: css.tabs, "aria-label": "\u6570\u636E\u6765\u6E90", children: ['file', 'pandadata', 'http'].map(value => _jsxs("button", { type: "button", disabled: busy, "aria-pressed": source === value, onClick: () => setSource(value), children: [value === 'file' ? _jsx(UploadSimpleIcon, {}) : _jsx(CloudArrowDownIcon, {}), value === 'file' ? '本地文件' : value === 'pandadata' ? 'PandaData' : '外部接口'] }, value)) }), _jsxs("label", { children: ["\u6570\u636E\u96C6\u540D\u79F0", _jsx("input", { required: true, maxLength: 160, value: name, onChange: e => setName(e.target.value), placeholder: "\u4F8B\u5982\uFF1A\u6CAA\u6DF1 300 \u65E5\u884C\u60C5" })] }), _jsxs("label", { children: ["\u6570\u636E\u5206\u7C7B", _jsxs("select", { value: category, onChange: e => setCategory(e.target.value), children: [_jsx("option", { value: "auto", children: "\u81EA\u52A8\u8BC6\u522B\uFF08\u63A8\u8350\uFF09" }), categories.map(item => _jsxs("option", { value: item.id, children: [item.label, " \u00B7 ", item.description] }, item.id))] })] }), _jsx("p", { children: "\u884C\u60C5\u770B\u4EF7\u683C\u4E0E\u6210\u4EA4\uFF0C\u65B0\u95FB\u770B\u8D44\u8BAF\u4E0E\u4E8B\u4EF6\uFF0C\u57FA\u672C\u9762\u770B\u8D22\u52A1\u4E0E\u516C\u53F8\u8D44\u6599\u3002\u65E5\u671F\u5B57\u6BB5\u4F1A\u5355\u72EC\u8BC6\u522B\uFF0C\u65E0\u9700\u5B9A\u4E49\u6570\u636E\u7ED3\u6784\u3002" }), source === 'file' ? _jsxs("label", { children: ["\u9009\u62E9\u6587\u4EF6\uFF08CSV / JSON\uFF0C\u6700\u5927 10 MB\uFF09", _jsx("input", { type: "file", accept: ".csv,.json", onChange: async (e) => { const file = e.target.files?.[0]; if (!file)
                                return; setError(''); setContent(''); if (file.size > 10 * 1024 * 1024) {
                                setError('文件不能超过 10 MB');
                                return;
                            } setContent(await file.text()); setFormat(file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'json'); if (!name)
                                setName(file.name.replace(/\.[^.]+$/, '')); } })] }) : source === 'http' ? _jsxs("label", { children: ["\u6570\u636E\u5730\u5740", _jsx("input", { required: true, type: "url", value: url, onChange: e => setUrl(e.target.value), placeholder: "https://\u2026 / CSV \u6216 JSON \u63A5\u53E3" })] }) : _jsxs(_Fragment, { children: [_jsx("p", { children: "\u586B\u5199\u5DF2\u67E5\u9605 PandaData \u6587\u6863\u7684\u53EA\u8BFB\u65B9\u6CD5\u4E0E\u53C2\u6570\u3002\u9700\u8981\u5148\u5728\u8BBE\u7F6E\u4E2D\u8FDE\u63A5 PandaData\u3002" }), _jsxs("label", { children: ["\u65B9\u6CD5\u540D", _jsx("input", { required: true, pattern: "get_.+", placeholder: "get_\u2026", value: method, onChange: e => setMethod(e.target.value) })] }), _jsxs("label", { children: ["\u63A5\u53E3\u53C2\u6570\uFF08JSON\uFF09", _jsx("textarea", { rows: 4, value: params, onChange: e => setParams(e.target.value) })] })] }), _jsxs("label", { children: ["\u7F13\u5B58\u6709\u6548\u671F\uFF08\u5206\u949F\uFF09", _jsx("input", { type: "number", required: true, min: 1, max: 525600, value: ttl, onChange: e => setTtl(Number(e.target.value)) })] }), _jsxs("details", { className: css.advanced, children: [_jsx("summary", { children: "\u65E5\u671F\u8BBE\u7F6E\uFF08\u53EF\u9009\uFF09" }), _jsxs("label", { children: ["\u65E5\u671F\u5217", _jsx("input", { placeholder: "\u81EA\u52A8\u8BC6\u522B\uFF1B\u5982\u9700\u6307\u5B9A\uFF0C\u8BF7\u586B\u5199\u771F\u5B9E\u5B57\u6BB5\u540D", value: dateColumn, onChange: e => setDateColumn(e.target.value) })] }), _jsx("p", { children: "\u6709\u6709\u6548\u65E5\u671F\u65F6\u53EF\u6309\u8303\u56F4\u67E5\u8BE2\uFF0C\u6CA1\u6709\u65E5\u671F\u65F6\u4ECD\u53EF\u4F5C\u4E3A\u7814\u7A76\u6570\u636E\u4FDD\u5B58\u3002" })] }), _jsxs("footer", { children: [_jsx("button", { type: "button", disabled: busy, onClick: close, children: "\u53D6\u6D88" }), _jsx("button", { type: "submit", className: css.primary, disabled: busy, children: busy ? '正在缓存…' : '导入并缓存' })] })] }) });
}
//# sourceMappingURL=DatabasePage.js.map