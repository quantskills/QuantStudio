const amount = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null;
/** Normalize the competition account, keeping unknown values distinct from zero. */
export function flyAccount(account, observedDay) {
    const balance = amount(account.totalProfit ?? account.equity ?? account.balance ?? account.Balance);
    const commission = amount(account.commission ?? account.Commission ?? account.cost);
    // positionPnl is the daily position P&L; holdingPnl may use opening cost instead.
    const position = amount(account.positionProfit ?? account.PositionProfit ?? account.positionPnl);
    const reportedClose = amount(account.closeProfit ?? account.CloseProfit);
    const daily = amount(account.dailyPnl), base = amount(account.staticProfit);
    // Panda's dailyPnl is already net of cost. Verify its equity identity before
    // recovering the gross close component consumed by the CTP-shaped analytics.
    const reconciled = balance !== null && base !== null && daily !== null && Math.abs(balance - base - daily) < .02;
    const derivedClose = reconciled && position !== null && commission !== null ? daily - position + commission : null;
    const tradingDay = String(account.tradingDay ?? account.TradingDay ?? account.tradeDate ?? '').replaceAll('-', '');
    const knownDay = /^\d{8}$/.test(tradingDay);
    return { knownDay, official: {
            Balance: balance, Available: amount(account.availableFunds ?? account.Available), Commission: commission,
            Deposit: amount(account.deposit ?? account.Deposit), Withdraw: amount(account.withdraw ?? account.Withdraw),
            CloseProfit: reportedClose ?? derivedClose, PositionProfit: position,
            TradingDay: knownDay ? tradingDay : observedDay,
            PnlSource: reportedClose !== null ? 'reported_close_profit' : derivedClose !== null ? 'panda_daily_net_reconciled' : '',
        } };
}
//# sourceMappingURL=fly-account.js.map