from decimal import Decimal

# Stripe charge units, not payout units. ISK and UGX retain two-decimal API representation.
ZERO={'bif','clp','djf','gnf','jpy','kmf','krw','mga','pyg','rwf','vnd','vuv','xaf','xof','xpf'}
THREE={'bhd','jod','kwd','omr','tnd'}
def format_minor(amount,currency):
    currency=currency.lower();places=0 if currency in ZERO else 3 if currency in THREE else 2
    return f'{Decimal(amount)/(Decimal(10)**places):.{places}f} {currency.upper()}'
