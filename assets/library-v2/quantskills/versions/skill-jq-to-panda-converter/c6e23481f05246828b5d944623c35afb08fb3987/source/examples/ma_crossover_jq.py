"""
JoinQuant (聚宽) MA5/MA20 Crossover Strategy
Original source — example for conversion to PandaAI
"""
import jqdata

def initialize(context):
    g.security = '000001.XSHE'
    set_benchmark('000300.XSHG')
    set_option('use_real_price', True)
    # Run every trading day at market open
    run_daily(market_open, time='every_bar')

def market_open(context):
    security = g.security
    
    # Get 20 days of closing prices
    close_data = attribute_history(security, 20, '1d', ['close'])
    if len(close_data) < 20:
        return
    
    # Compute moving averages
    MA5 = close_data['close'][-5:].mean()
    MA20 = close_data['close'].mean()
    current_price = close_data['close'][-1]
    cash = context.portfolio.available_cash
    
    has_position = security in context.portfolio.positions
    
    # Entry: golden cross — price above MA5, MA5 above MA20
    if current_price > MA5 > MA20 and not has_position:
        order_value(security, cash * 0.95)
        log.info("买入 %s 价格: %.2f MA5: %.2f MA20: %.2f" % (
            security, current_price, MA5, MA20))
    
    # Exit: death cross — price below MA5 or MA5 below MA20
    elif (current_price < MA5 or MA5 < MA20) and has_position:
        order_target(security, 0)
        log.info("卖出 %s 价格: %.2f MA5: %.2f MA20: %.2f" % (
            security, current_price, MA5, MA20))
    
    # Record for charting
    record(ma5=MA5, ma20=MA20, price=current_price)
