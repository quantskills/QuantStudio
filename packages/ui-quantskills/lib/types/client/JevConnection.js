import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { waitForCompetition } from "./competition-async.js";
import css from './ContestPage.module.css';
export function JevConnection({ access, disabled, onConfigured, onBusy }) {
    const [settings, setSettings] = useState(), [key, setKey] = useState('');
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const [translation, setTranslation] = useState('');
    useEffect(() => {
        let disposed = false;
        void waitForCompetition(() => access.settings(), 'Jev 配置').then(value => {
            if (!disposed) {
                setSettings(value);
                setTranslation(value.translator ? JSON.stringify(value.translator) : '');
                onConfigured(value.configured);
            }
        }).catch(failure => { if (!disposed)
            setError(failure instanceof Error ? failure.message : '配置读取失败，请重新进入页面。'); });
        return () => { disposed = true; };
    }, [access, onConfigured]);
    const test = async (save) => {
        if (busy || disabled)
            return;
        setBusy(true);
        onBusy(true);
        setError('');
        const candidate = key.trim();
        setKey('');
        try {
            const value = await waitForCompetition(() => access.configure(save ? { apiKey: candidate } : {}), 'Jev 连接测试', 45000);
            setSettings(value);
            onConfigured(value.configured);
        }
        catch (failure) {
            setError(failure instanceof Error ? failure.message : '连接测试失败，请重试。');
        }
        finally {
            setBusy(false);
            onBusy(false);
        }
    };
    return _jsxs("details", { className: css.jevConnection, open: settings ? !settings.configured : true, children: [_jsxs("summary", { children: [_jsx("span", { children: "Jev \u8FDE\u63A5\u914D\u7F6E" }), _jsx("span", { className: css.jevBadge, "data-ready": settings?.configured, children: settings?.configured ? '密钥已配置' : '等待配置' })] }), _jsxs("div", { className: css.jevConnectionBody, children: [_jsxs("p", { children: ["\u5728 ", _jsx("a", { href: "https://docs.typesafe.ai/introduction", target: "_blank", rel: "noreferrer", children: "TypeSafe" }), " \u83B7\u53D6\u81EA\u5DF1\u7684 API Key\uFF0C\u6D4B\u8BD5\u6210\u529F\u540E\u4FDD\u5B58\u3002\u6BCF\u4F4D\u7528\u6237\u5728\u81EA\u5DF1\u7684\u7535\u8111\u4E0A\u5B8C\u6210\u914D\u7F6E\u3002"] }), _jsxs("form", { className: css.jevKeyForm, onSubmit: event => { event.preventDefault(); void test(true); }, children: [_jsxs("label", { children: ["Jev API Key", _jsx("input", { type: "password", autoComplete: "new-password", spellCheck: false, required: true, maxLength: 4096, value: key, disabled: disabled || busy || settings?.writable === false, placeholder: settings?.configured ? '输入新密钥以替换，已保存密钥不回显' : '粘贴 TypeSafe API Key', onChange: event => setKey(event.target.value) })] }), _jsx("button", { type: "submit", "data-primary": true, disabled: disabled || busy || !settings?.writable || !key.trim(), children: busy ? '正在测试连接…' : '测试并保存密钥' }), _jsx("button", { type: "button", disabled: disabled || busy || !settings?.configured, onClick: () => { void test(false); }, children: "\u6D4B\u8BD5\u5DF2\u4FDD\u5B58\u8FDE\u63A5" })] }), _jsxs("div", { className: css.jevKeyForm, children: [_jsxs("label", { children: ["\u4E2D\u6587\u4E13\u7528\u7FFB\u8BD1\u6A21\u578B", _jsxs("select", { value: translation, disabled: disabled || busy, onChange: event => setTranslation(event.target.value), children: [_jsx("option", { value: "", children: "\u8BF7\u9009\u62E9\u5DF2\u9A8C\u8BC1\u7684\u6A21\u578B" }), (settings?.translationModels ?? []).map(item => _jsxs("option", { value: JSON.stringify(item), children: [item.model, " \u00B7 ", item.provider] }, JSON.stringify(item)))] })] }), _jsx("button", { type: "button", disabled: disabled || busy || !translation, onClick: async () => {
                                    setBusy(true);
                                    onBusy(true);
                                    setError('');
                                    try {
                                        setSettings(await access.configure({ translator: JSON.parse(translation) }));
                                    }
                                    catch (failure) {
                                        setError(failure instanceof Error ? failure.message : '翻译配置保存失败。');
                                    }
                                    finally {
                                        setBusy(false);
                                        onBusy(false);
                                    }
                                }, children: "\u4FDD\u5B58\u7FFB\u8BD1\u6A21\u578B" })] }), _jsx("p", { className: css.jevFine, children: "\u5185\u7F6E\u6A21\u677F\u4F7F\u7528\u9884\u7F6E\u82F1\u6587\u3002\u81EA\u5B9A\u4E49\u4E2D\u6587\u53CA\u53C2\u8003\u8D44\u6599\u7ECF\u6240\u9009\u6A21\u578B\u7FFB\u8BD1\u540E\u4EA4\u7ED9 Jev\uFF0C\u539F\u6587\u4FDD\u7559\uFF1B\u76F8\u540C\u5185\u5BB9\u590D\u7528\u7FFB\u8BD1\u3002\u7FFB\u8BD1\u4EA7\u751F\u72EC\u7ACB\u7528\u91CF\uFF0C\u4E0D\u4FEE\u6539 Auto \u8BBE\u7F6E\u3002\u6A21\u578B\u5217\u8868\u4E3A\u7A7A\u65F6\uFF0C\u8BF7\u5148\u5728\u6A21\u578B\u670D\u52A1\u4E2D\u6DFB\u52A0\u5E76\u9A8C\u8BC1\u8FDE\u63A5\u3002" }), settings?.writable === false && _jsx("p", { children: "\u5F53\u524D\u51ED\u636E\u53EA\u8BFB\uFF1B\u8BF7\u5728\u914D\u7F6E\u8BE5\u5BC6\u94A5\u7684\u73AF\u5883\u53D8\u91CF\u4E2D\u4FEE\u6539\u3002" }), _jsx("p", { className: css.jevFine, children: "\u5BC6\u94A5\u4FDD\u5B58\u5728\u672C\u673A\u51ED\u636E\u5E93\u3002\u8FDE\u63A5\u6D4B\u8BD5\u4F1A\u53D1\u8D77\u4E00\u6B21\u5C0F\u578B Jev \u8BF7\u6C42\uFF0C\u4E0D\u53D1\u9001\u6BD4\u8D5B\u8D26\u6237\u6216\u884C\u60C5\u3002\u8FD0\u884C\u76EF\u76D8\u524D\u5148\u8FDE\u63A5\u6BD4\u8D5B\u8D26\u6237\u3002" }), settings?.message && _jsxs("p", { "aria-live": "polite", children: [settings.message, settings.latencyMs !== undefined ? ` · ${settings.latencyMs} ms` : ''] }), error && _jsx("p", { className: css.error, role: "alert", children: error })] })] });
}
//# sourceMappingURL=JevConnection.js.map