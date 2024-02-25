// We go through the trouble of caching the results of these functions
// that return functions in order to ensure React PureComponents will
// view getting the same result as a non-change.

export const fmt_isk = (num) => format_with_decimals(num, 2);
const _get_formatter_cache = {};
function _make_isk_formatter(zeroes: number) {
    if (zeroes < 3) {
        return fmt_isk;
    } else if (zeroes < 6) {
        return (num) => format_with_decimals(num / 1000000, 6 - zeroes) + "M";
    } else if (zeroes < 9) {
        return (num) => format_with_decimals(num / 1000000000, 9 - zeroes) + "B";
    } else {
        return (num) => format_with_decimals(num / 1000000000000, 12 - zeroes) + "T";
    }
}

// populate the cache
for (let i = 0; i < 10; i++) {
    _get_formatter_cache[i] = _make_isk_formatter(i);
}

export function get_formatter(prices: number[]) {
    prices = prices.map((price) => Math.floor(price));
    const trailing_zeros = prices.map((price) => {
        let multiplier = 10;
        let zero_count = 0;
        while (price % multiplier == 0) {
            multiplier *= 10;
            zero_count += 1;
        }
        return zero_count;
    });
    const zeroes = Math.min(...trailing_zeros);
    if (zeroes < 10) {
        return _get_formatter_cache[zeroes];
    }
    const formatter = _make_isk_formatter(zeroes);
    _get_formatter_cache[zeroes] = formatter;
    return formatter;
}

export function format_with_decimals(num: number, dec: number): string {
    num = Math.floor(num * Math.pow(10, dec)) * Math.pow(10, -dec);
    return num.toLocaleString(undefined, {
        minimumFractionDigits: dec,
        maximumFractionDigits: dec,
    });
}

export function format_duration(seconds: number, show_all_figures?: boolean) {
    let d = Math.floor(seconds / 86400);
    let h = Math.floor((seconds % 86400) / 3600);
    let m = Math.floor(((seconds % 86400) % 3600) / 60);
    let s = ((seconds % 86400) % 3600) % 60;
    if (show_all_figures === false) {
        // Only show two figures.
        if (d) {
            // '9d 8m' looks right, '9d' does not.
            if (h == 0) {
                s = 0;
            } else {
                if (m > 30) {
                    h += 1;
                    if (h == 24) {
                        d += 1;
                        h = 0;
                    }
                }

                m = s = 0;
            }
        } else if (h) {
            if (s > 30) {
                m += 1;
                if (m == 60) {
                    h += 1;
                    m = 0;
                    if (h == 24) {
                        d += 1;
                        h = 0;
                    }
                }
            }
            s = 0;
        }
    }
    return [
        [d, "d"],
        [h, "h"],
        [m, "m"],
        [s | 0, "s"],
    ]
        .filter((x) => x[0])
        .reduce((a, [v, l]) => (a += (v as string) + l + " "), "")
        .trim();
}
